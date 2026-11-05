import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { ECONOMICS } from "@/config/economics";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx, listing, positionEntry } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import { newId } from "@/lib/ids";
import { dailyEarnings, earningsAt, kwOwnedAt, type KwEntry } from "@/lib/portfolio-math";
import { DAY_MS, dayStartMs, instantReading, localDayIndex } from "@/lib/sim";
import type { Config } from "@/lib/settings";
import { buildCurves } from "@/lib/telemetry/service";

export interface TxDTO {
  id: string;
  kind: string;
  status: string;
  kw: number | null;
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
  /** Pasarela de una compra: demo, mercadopago o crypto */
  method: string | null;
  providerStatus: string | null;
  chainId: number | null;
}

export interface PortfolioDTO {
  asOf: number;
  kw: number;
  listedKw: number;
  availableKw: number;
  sharePct: number;
  investedCop: number;
  earnedCop: number;
  earnedTodayCop: number;
  saleProceedsCop: number;
  withdrawnCop: number;
  /** Retiros esperando aprobación del administrador */
  reservedCop: number;
  balanceCop: number;
  yieldEa: number;
  energyKwh: number;
  co2Kg: number;
  trees: number;
  homes: number;
  ratePerSecondCop: number;
  capacityKwp: number;
  netFactor: number;
  pricePerKwCop: number;
  daily: { day: number; date: string; earnedCop: number; kw: number }[];
  growth: { day: number; date: string; investedCop: number; earningsCop: number }[];
  transactions: TxDTO[];
}

export function isoDay(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

async function loadEntries(userId: string) {
  return db
    .select({ kwDelta: positionEntry.kwDelta, ts: positionEntry.ts, pricePerKwCop: positionEntry.pricePerKwCop })
    .from(positionEntry)
    .where(eq(positionEntry.userId, userId));
}

/** En modo demo, las cuentas nuevas reciben una posición de regalo (configurable con DEMO_STARTER_KW). */
async function grantStarterIfNeeded(userId: string, commissionedAt: number, now: number, pricePerKwCop: number) {
  if (!isDemoMode() || env.starterKw <= 0) return false;
  const [had] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(eq(ledgerTx.userId, userId));
  if (had.n > 0) return false;
  const ts = Math.max(commissionedAt + DAY_MS, now - 30 * DAY_MS);
  const txId = newId("tx-");
  const amountCop = Math.round(env.starterKw * pricePerKwCop);
  await db.batch([
    db.insert(ledgerTx).values({
      id: txId,
      userId,
      kind: "asignacion_demo",
      status: "confirmada",
      kw: env.starterKw,
      amountCop,
      asset: "COP",
      walletName: "Solaxy",
      createdAt: ts,
      confirmedAt: ts,
    }),
    db.insert(positionEntry).values({
      id: newId("pe-"),
      userId,
      plantId: PLANT.id,
      kwDelta: env.starterKw,
      pricePerKwCop,
      ts,
      txId,
    }),
  ]);
  return true;
}

export async function getKwPosition(userId: string, now = Date.now()) {
  const entries = await loadEntries(userId);
  const kw = kwOwnedAt(entries, now);
  const [listed] = await db
    .select({ kw: sql<number>`coalesce(sum(${listing.kw}), 0)` })
    .from(listing)
    .where(and(eq(listing.sellerId, userId), eq(listing.status, "activa")));
  const invested = entries.reduce((s, e) => s + e.kwDelta * e.pricePerKwCop, 0);
  return { entries, kw, listedKw: listed.kw, availableKw: Math.max(0, round1(kw - listed.kw)), investedCop: invested };
}

export async function getBalances(userId: string, entries: KwEntry[], now: number, cfg?: Pick<Config, "spec" | "econ">) {
  const { spec, econ } = cfg ?? (await ensureReady(now));
  const { net } = await buildCurves(db, spec, [now, ...entries.map((e) => e.ts)], now, econ);
  const earned = earningsAt(entries, net, now);
  const sums = await db
    .select({ kind: ledgerTx.kind, total: sql<number>`coalesce(sum(${ledgerTx.amountCop}), 0)` })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), eq(ledgerTx.status, "confirmada")))
    .groupBy(ledgerTx.kind);
  const byKind = Object.fromEntries(sums.map((s) => [s.kind, s.total])) as Record<string, number>;
  const saleProceeds = (byKind.venta_inmediata ?? 0) + (byKind.venta_p2p ?? 0);
  const withdrawn = byKind.retiro ?? 0;
  // Retiros esperando aprobación: apartan saldo hasta que el admin decida.
  const [held] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerTx.amountCop}), 0)` })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), eq(ledgerTx.kind, "retiro"), eq(ledgerTx.status, "por_aprobar")));
  const reserved = held.total;
  return { earned, saleProceeds, withdrawn, reserved, balance: Math.max(0, earned + saleProceeds - withdrawn - reserved) };
}

export async function getPortfolio(userId: string, now = Date.now()): Promise<PortfolioDTO> {
  const { commissionedAt, spec, econ } = await ensureReady(now);
  await grantStarterIfNeeded(userId, commissionedAt, now, econ.pricePerKwCop);
  const pos = await getKwPosition(userId, now);
  const entries = pos.entries;

  const today = localDayIndex(now);
  const growthDays = Array.from({ length: 90 }, (_, k) => today - 89 + k);
  const dailyDays = growthDays.slice(-30);
  const dayEnd = (d: number) => Math.min(dayStartMs(d + 1), now);
  const stamps = [
    now,
    now - 30 * DAY_MS,
    ...entries.map((e) => e.ts),
    ...growthDays.map(dayStartMs),
    ...growthDays.map(dayEnd),
  ];
  const { net, energy } = await buildCurves(db, spec, stamps, now, econ);

  const earned = earningsAt(entries, net, now);
  const daily = dailyEarnings(entries, net, dailyDays, now).map((d) => ({ ...d, date: isoDay(d.day) }));
  const growth = growthDays.map((d) => {
    const end = dayEnd(d);
    const invested = entries.filter((e) => e.ts <= end).reduce((s, e) => s + e.kwDelta * e.pricePerKwCop, 0);
    return { day: d, date: isoDay(d), investedCop: Math.round(invested), earningsCop: earningsAt(entries, net, end) };
  });

  const balances = await getBalances(userId, entries, now, { spec, econ });
  const energyKwh = earningsAt(entries, energy, now);
  const co2Kg = energyKwh * ECONOMICS.co2KgPerKwh;
  const perKwpYear = ((net.at(now) - net.at(now - 30 * DAY_MS)) * 365) / 30;
  const reading = instantReading(spec, now, econ);
  const ratePerSecondCop =
    (reading.deliveredKw * (pos.kw / spec.capacityKwp) * reading.tariffCopPerKwh * econ.netFactor) / 3600;
  const kwhPerKwpDay = ((energy.at(now) - energy.at(now - 30 * DAY_MS)) / 30) || 0;

  const txs = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), sql`${ledgerTx.status} != 'pendiente'`))
    .orderBy(desc(ledgerTx.createdAt))
    .limit(60);

  return {
    asOf: now,
    kw: pos.kw,
    listedKw: pos.listedKw,
    availableKw: pos.availableKw,
    sharePct: (pos.kw / spec.capacityKwp) * 100,
    investedCop: Math.round(pos.investedCop),
    earnedCop: earned,
    earnedTodayCop: daily.at(-1)?.earnedCop ?? 0,
    saleProceedsCop: balances.saleProceeds,
    withdrawnCop: balances.withdrawn,
    reservedCop: balances.reserved,
    balanceCop: balances.balance,
    yieldEa: perKwpYear / econ.pricePerKwCop,
    energyKwh,
    co2Kg,
    trees: co2Kg / ECONOMICS.treeCo2KgPerYear,
    homes: (pos.kw * kwhPerKwpDay * 30) / ECONOMICS.homeKwhPerMonth,
    ratePerSecondCop,
    capacityKwp: spec.capacityKwp,
    netFactor: econ.netFactor,
    pricePerKwCop: econ.pricePerKwCop,
    daily,
    growth,
    transactions: txs.map(toTxDTO),
  };
}

export function toTxDTO(t: typeof ledgerTx.$inferSelect): TxDTO {
  return {
    id: t.id,
    kind: t.kind,
    status: t.status,
    kw: t.kw,
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
  };
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}
