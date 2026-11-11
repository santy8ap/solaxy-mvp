import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SolarDay } from "@/config/solar";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { GRACE_MS, generatedKwh, type SubscriptionState } from "@/lib/energy/plan-math";
import { summarize } from "@/lib/energy/summary";
import { listSubscriptions, periodsOf, stateOf, type SubscriptionWithPeriods } from "@/lib/plans/service";
import { readConfig } from "@/lib/settings";

/** Un movimiento del usuario: pago de un mes de un plan o retiro. */
export interface TxDTO {
  id: string;
  kind: string;
  status: string;
  amountCop: number;
  asset: string | null;
  assetAmount: number | null;
  network: string | null;
  walletAddress: string | null;
  walletName: string | null;
  txHash: string | null;
  note: string | null;
  createdAt: number;
  confirmedAt: number | null;
  /** Pasarela de un pago: mercadopago, crypto, manual o demo (pago de prueba) */
  method: string | null;
  providerStatus: string | null;
  chainId: number | null;
  subscriptionId: string | null;
  periodIndex: number | null;
  kwh: number | null;
  bankName: string | null;
  bankAccountType: string | null;
  /** Solo los últimos 4 dígitos de la cuenta */
  bankAccountLast4: string | null;
}

export interface PeriodDTO {
  index: number;
  startsAt: number;
  endsAt: number;
}

export interface SubscriptionDTO {
  id: string;
  planId: string;
  planName: string;
  totalKwh: number;
  months: number;
  dailyKwh: number;
  monthlyKwh: number;
  monthlyCop: number;
  priceCopPerKwh: number;
  saleCopPerKwh: number;
  state: SubscriptionState;
  paidMonths: number;
  periods: PeriodDTO[];
  startedAt: number | null;
  /** Fin del último mes pagado: cuándo hay que haber pagado el siguiente */
  paidUntil: number;
  /** Si está en pausa, hasta cuándo se puede pagar antes de que el plan se cierre */
  graceEndsAt: number | null;
  generatedKwh: number;
}

/**
 * Resumen del usuario. Los totales valen en `asOf`; con `solar` y los periodos de cada plan
 * el navegador los sigue calculando en vivo con las mismas funciones (lib/energy).
 */
export interface PortfolioDTO {
  asOf: number;
  solar: SolarDay;
  subscriptions: SubscriptionDTO[];
  generatedKwh: number;
  todayKwh: number;
  /** Venta de la energía generada (COP) */
  soldCop: number;
  /** Lo que costó esa energía al precio del plan (COP) */
  costCop: number;
  profitCop: number;
  /** kWh y utilidad por día de los planes activos en este momento */
  dailyKwh: number;
  dailyProfitCop: number;
  withdrawnCop: number;
  /** Retiros esperando al administrador */
  reservedCop: number;
  balanceCop: number;
  transactions: TxDTO[];
}

export function toSubscriptionDTO(sub: SubscriptionWithPeriods, solar: SolarDay, now: number): SubscriptionDTO {
  const periods = periodsOf(sub);
  const state = stateOf(sub, now);
  const paidUntil = Math.max(...sub.periods.map((p) => p.endsAt));
  const monthlyKwh = sub.totalKwh / sub.months;
  return {
    id: sub.id,
    planId: sub.planId,
    planName: sub.planName,
    totalKwh: sub.totalKwh,
    months: sub.months,
    dailyKwh: sub.dailyKwh,
    monthlyKwh,
    monthlyCop: Math.round(monthlyKwh * sub.priceCopPerKwh),
    priceCopPerKwh: sub.priceCopPerKwh,
    saleCopPerKwh: sub.saleCopPerKwh,
    state,
    paidMonths: sub.periods.length,
    periods,
    startedAt: sub.startedAt,
    paidUntil,
    graceEndsAt: state === "en_pausa" ? paidUntil + GRACE_MS : null,
    generatedKwh: generatedKwh(solar, sub.dailyKwh, periods, now),
  };
}

export { summarize };

/** Retiros ya pagados y retiros en revisión (estos apartan saldo hasta que el admin decida). */
async function withdrawalTotals(userId: string) {
  const [row] = await db
    .select({
      withdrawn: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
      reserved: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then ${ledgerTx.amountCop} end), 0)`,
    })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), eq(ledgerTx.kind, "retiro")));
  return { withdrawn: Number(row?.withdrawn ?? 0), reserved: Number(row?.reserved ?? 0) };
}

/** Saldo disponible: venta de la energía generada, menos lo retirado y lo que está en revisión. Nunca se redondea hacia arriba. */
export async function getBalance(userId: string, now = Date.now()) {
  const { solar } = await readConfig();
  const subs = (await listSubscriptions(userId)).map((s) => toSubscriptionDTO(s, solar, now));
  const totals = summarize(subs, solar, now);
  const w = await withdrawalTotals(userId);
  return { ...totals, ...w, balance: Math.max(0, Math.floor(totals.soldCop) - w.withdrawn - w.reserved) };
}

export async function getPortfolio(userId: string, now = Date.now()): Promise<PortfolioDTO> {
  const { solar } = await readConfig();
  const subscriptions = (await listSubscriptions(userId)).map((s) => toSubscriptionDTO(s, solar, now));
  const totals = summarize(subscriptions, solar, now);
  const w = await withdrawalTotals(userId);
  const txs = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), sql`${ledgerTx.status} != 'pendiente'`))
    .orderBy(desc(ledgerTx.createdAt))
    .limit(60);
  return {
    asOf: now,
    solar,
    subscriptions,
    ...totals,
    withdrawnCop: w.withdrawn,
    reservedCop: w.reserved,
    balanceCop: Math.max(0, Math.floor(totals.soldCop) - w.withdrawn - w.reserved),
    transactions: txs.map(toTxDTO),
  };
}

export function toTxDTO(t: typeof ledgerTx.$inferSelect): TxDTO {
  return {
    id: t.id,
    kind: t.kind,
    status: t.status,
    amountCop: t.amountCop,
    asset: t.asset,
    assetAmount: t.assetAmount,
    network: t.network,
    walletAddress: t.walletAddress,
    walletName: t.walletName,
    txHash: t.txHash,
    note: t.note ?? null,
    createdAt: t.createdAt,
    confirmedAt: t.confirmedAt,
    method: t.method ?? null,
    providerStatus: t.providerStatus ?? null,
    chainId: t.chainId ?? null,
    subscriptionId: t.subscriptionId ?? null,
    periodIndex: t.periodIndex ?? null,
    kwh: t.kwh ?? null,
    bankName: t.bankName ?? null,
    bankAccountType: t.bankAccountType ?? null,
    bankAccountLast4: t.bankAccountNumber ? t.bankAccountNumber.slice(-4) : null,
  };
}
