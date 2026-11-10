import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { planPeriod, planSubscription } from "@/lib/db/schema";
import { GRACE_MS, nextPeriodWindow, reservesCapacity, subscriptionState, type Period, type SubscriptionState } from "@/lib/energy/plan-math";
import { MarketError } from "@/lib/errors";
import { newId, planCode } from "@/lib/ids";
import type { CatalogPlan } from "@/lib/plant-settings";
import { readConfig } from "@/lib/settings";

/**
 * Planes de energía: catálogo con cupo, qué mes se paga y la activación del periodo cuando el
 * pago se confirma. El estado de un plan nunca se guarda: se deriva de sus periodos.
 */

export type SubscriptionRow = typeof planSubscription.$inferSelect;
export type PeriodRow = typeof planPeriod.$inferSelect;
export interface SubscriptionWithPeriods extends SubscriptionRow {
  periods: PeriodRow[];
}

/** Tolerancia al comparar kWh (los kWh diarios son números enteros; esto solo cubre el redondeo). */
const EPS_KWH = 1e-6;

/**
 * Los meses pagados de un plan, como ventanas de tiempo. Si el admin cerró el plan,
 * la energía deja de generarse en ese instante: los periodos se recortan ahí.
 */
export function periodsOf(sub: SubscriptionWithPeriods): Period[] {
  const cut = sub.cancelledAt;
  return sub.periods
    .filter((p) => cut == null || p.startsAt < cut)
    .map((p) => ({ index: p.idx, startsAt: p.startsAt, endsAt: cut == null ? p.endsAt : Math.min(p.endsAt, cut) }));
}

export function stateOf(sub: SubscriptionWithPeriods, now: number): SubscriptionState {
  return subscriptionState(sub, periodsOf(sub), now);
}

/**
 * kWh diarios que ya ocupan cupo de la planta: planes activos o en pausa (dentro de los 15 días de gracia).
 * Es SQL puro para poder usarlo dentro de la sentencia que activa un periodo (ver activatePeriod).
 */
function reservedDailyKwhSql(now: number, excludeSubscriptionId: string) {
  return sql`(
    SELECT coalesce(sum(s.daily_kwh), 0)
    FROM plan_subscription s
    JOIN (SELECT subscription_id, count(*) AS n, max(ends_at) AS last_end FROM plan_period GROUP BY subscription_id) p ON p.subscription_id = s.id
    WHERE s.cancelled_at IS NULL
      AND s.id != ${excludeSubscriptionId}
      AND ((p.n >= s.months AND p.last_end > ${now}) OR (p.n < s.months AND p.last_end + ${GRACE_MS} >= ${now}))
  )`;
}

export async function contractedDailyKwh(now = Date.now(), excludeSubscriptionId = "") {
  const [row] = await db.select({ kwh: sql<number>`${reservedDailyKwhSql(now, excludeSubscriptionId)}` }).from(sql`(SELECT 1)`);
  return Number(row?.kwh ?? 0);
}

async function withPeriods(subs: SubscriptionRow[]): Promise<SubscriptionWithPeriods[]> {
  if (!subs.length) return [];
  const periods = await db
    .select()
    .from(planPeriod)
    .where(inArray(planPeriod.subscriptionId, subs.map((s) => s.id)))
    .orderBy(asc(planPeriod.idx));
  const bySub = new Map<string, PeriodRow[]>();
  for (const p of periods) bySub.set(p.subscriptionId, [...(bySub.get(p.subscriptionId) ?? []), p]);
  return subs.map((s) => ({ ...s, periods: bySub.get(s.id) ?? [] }));
}

/** Planes del usuario que ya empezaron (los borradores sin pagar no se muestran). */
export async function listSubscriptions(userId: string): Promise<SubscriptionWithPeriods[]> {
  const subs = await db.select().from(planSubscription).where(eq(planSubscription.userId, userId)).orderBy(asc(planSubscription.createdAt));
  return (await withPeriods(subs)).filter((s) => s.periods.length > 0);
}

export async function listAllSubscriptions(): Promise<SubscriptionWithPeriods[]> {
  const subs = await db.select().from(planSubscription).orderBy(asc(planSubscription.createdAt));
  return (await withPeriods(subs)).filter((s) => s.periods.length > 0);
}

export async function getSubscription(id: string): Promise<SubscriptionWithPeriods | null> {
  const [sub] = await db.select().from(planSubscription).where(eq(planSubscription.id, id));
  return sub ? (await withPeriods([sub]))[0] : null;
}

/** El catálogo vigente con el cupo de la planta. */
export async function getCatalog(now = Date.now()) {
  const { settings, solar, catalog, plantDailyKwh } = await readConfig();
  const contracted = await contractedDailyKwh(now);
  const available = Math.max(0, plantDailyKwh - contracted);
  return {
    plantName: settings.name,
    location: settings.location,
    solar,
    saleCopPerKwh: settings.saleCopPerKwh,
    plantDailyKwh,
    contractedDailyKwh: contracted,
    availableDailyKwh: available,
    plans: catalog.map((p) => ({ ...p, available: p.dailyKwh <= available + EPS_KWH })),
  };
}

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/** Qué paga una orden: un mes de un plan. */
export interface PlanPayment {
  subscriptionId: string;
  planId: string;
  planName: string;
  periodIndex: number;
  months: number;
  /** Energía del mes (kWh) */
  kwh: number;
  amountCop: number;
}

const NO_CAPACITY = "La planta no tiene cupo para ese plan en este momento. Elige un plan más pequeño o escríbenos.";

const monthOf = (sub: Pick<SubscriptionRow, "totalKwh" | "months" | "priceCopPerKwh">) => {
  const kwh = sub.totalKwh / sub.months;
  return { kwh, amountCop: Math.round(kwh * sub.priceCopPerKwh) };
};

/** Un borrador del mismo plan y con los mismos precios se reutiliza: abandonar un pago no deja basura. */
async function draftFor(userId: string, plan: CatalogPlan, now: number) {
  const drafts = await db
    .select()
    .from(planSubscription)
    .where(and(eq(planSubscription.userId, userId), eq(planSubscription.planId, plan.id), sql`${planSubscription.startedAt} IS NULL`, sql`${planSubscription.cancelledAt} IS NULL`));
  const same = drafts.find((d) => d.priceCopPerKwh === plan.priceCopPerKwh && d.saleCopPerKwh === plan.saleCopPerKwh && d.totalKwh === plan.totalKwh && d.months === plan.months);
  if (same) return same;
  const [row] = await db
    .insert(planSubscription)
    .values({
      id: planCode(),
      userId,
      planId: plan.id,
      planName: plan.name,
      totalKwh: plan.totalKwh,
      months: plan.months,
      dailyKwh: plan.dailyKwh,
      priceCopPerKwh: plan.priceCopPerKwh,
      saleCopPerKwh: plan.saleCopPerKwh,
      createdAt: now,
    })
    .returning();
  return row;
}

/**
 * Valida qué se va a pagar y calcula el monto: el primer mes de un plan nuevo (`planId`)
 * o el mes siguiente de un plan que ya tiene el usuario (`subscriptionId`).
 */
export async function resolvePlanPayment(userId: string, input: { planId?: string; subscriptionId?: string }, now = Date.now()): Promise<PlanPayment> {
  if (input.subscriptionId) {
    const sub = await getSubscription(input.subscriptionId);
    if (!sub || sub.userId !== userId) throw new MarketError("No encontramos ese plan en tu cuenta", 404);
    const state = stateOf(sub, now);
    if (state === "completada") throw new MarketError("Este plan ya tiene todos sus meses pagados.", 409);
    if (state === "vencida" || state === "cancelada") throw new MarketError("Este plan se cerró. Compra un plan nuevo para seguir generando energía.", 409);
    if (state === "borrador" && (await contractedDailyKwh(now)) + sub.dailyKwh > (await readConfig()).plantDailyKwh + EPS_KWH) throw new MarketError(NO_CAPACITY, 409);
    return { subscriptionId: sub.id, planId: sub.planId, planName: sub.planName, periodIndex: sub.periods.length + 1, months: sub.months, ...monthOf(sub) };
  }

  const { catalog, plantDailyKwh } = await readConfig();
  const plan = catalog.find((p) => p.id === input.planId);
  if (!plan) throw new MarketError("Elige uno de los planes disponibles");
  if ((await contractedDailyKwh(now)) + plan.dailyKwh > plantDailyKwh + EPS_KWH) throw new MarketError(NO_CAPACITY, 409);
  const draft = await draftFor(userId, plan, now);
  return { subscriptionId: draft.id, planId: draft.planId, planName: draft.planName, periodIndex: 1, months: draft.months, ...monthOf(draft) };
}

export type ActivationOutcome = "activado" | "sin_cupo" | "mes_pagado" | "plan_cerrado";

function isUniqueViolation(err: unknown) {
  return /UNIQUE/i.test(String((err as { message?: string })?.message ?? err)) || /UNIQUE/i.test(String((err as { cause?: unknown })?.cause ?? ""));
}

/**
 * Activa el mes que pagó una orden. El periodo se inserta con una sola sentencia que comprueba el cupo:
 * dos pagos que llegan a la vez no pueden vender la misma energía dos veces.
 */
export async function activatePeriod(order: { id: string; subscriptionId: string | null; periodIndex: number | null; amountCop: number; kwh: number | null }, now = Date.now()): Promise<ActivationOutcome> {
  const sub = order.subscriptionId ? await getSubscription(order.subscriptionId) : null;
  if (!sub || sub.cancelledAt != null) return "plan_cerrado";
  const window = nextPeriodWindow(periodsOf(sub), now);
  if (sub.periods.length >= sub.months || order.periodIndex !== window.index) return "mes_pagado";

  // Un plan activo o en pausa ya tiene su cupo apartado; uno nuevo (o vencido) lo pide ahora.
  const holdsCapacity = reservesCapacity(stateOf(sub, now));
  const { plantDailyKwh } = await readConfig();
  const fits = holdsCapacity ? sql`1 = 1` : sql`${reservedDailyKwhSql(now, sub.id)} + ${sub.dailyKwh} <= ${plantDailyKwh + EPS_KWH}`;
  const kwh = order.kwh ?? sub.totalKwh / sub.months;
  try {
    const res = await db.run(sql`
      INSERT INTO plan_period (id, subscription_id, idx, starts_at, ends_at, kwh, amount_cop, tx_id, created_at)
      SELECT ${newId("per-")}, ${sub.id}, ${window.index}, ${window.startsAt}, ${window.endsAt}, ${kwh}, ${order.amountCop}, ${order.id}, ${now}
      WHERE ${fits}
    `);
    if (!res.rowsAffected) return "sin_cupo";
  } catch (err) {
    if (isUniqueViolation(err)) return "mes_pagado";
    throw err;
  }
  if (sub.startedAt == null) await db.update(planSubscription).set({ startedAt: now }).where(and(eq(planSubscription.id, sub.id), sql`${planSubscription.startedAt} IS NULL`));
  return "activado";
}
