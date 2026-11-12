import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyProfile, ledgerTx, user } from "@/lib/db/schema";
import { GRACE_MS } from "@/lib/energy/plan-math";
import { env } from "@/lib/env";
import { collectedWhere } from "@/lib/payments/real-money";
import { contractedDailyKwh, listAllSubscriptions } from "@/lib/plans/service";
import { toSubscriptionDTO } from "@/lib/portfolio";
import { TERMS_VERSION } from "@/lib/profile";
import { hasPersonalDetails } from "@/lib/profile-schema";
import { readConfig } from "@/lib/settings";
import { DAY_MS, TZ_OFFSET_MS } from "@/lib/time";

/**
 * Analítica del negocio para el admin: cuánto entra y por dónde, cómo avanzan los clientes y qué
 * mensualidades vienen. Todo en hora de Colombia. El recaudo sigue la misma regla que el resto del admin
 * (lib/payments/real-money): con dinero real no cuentan los pagos de prueba.
 */

/** "2026-11": el mes de un instante, en hora de Colombia. */
export function monthKey(ts: number) {
  return new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 7);
}

/** Inicio (ms UTC) del mes "2026-11" en hora de Colombia. */
export function monthStartMs(key: string) {
  const [y, m] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, 1) - TZ_OFFSET_MS;
}

/** Los últimos `n` meses con el actual, del más antiguo al más reciente. */
export function lastMonths(now: number, n = 12): string[] {
  const d = new Date(now + TZ_OFFSET_MS);
  const base = d.getUTCFullYear() * 12 + d.getUTCMonth();
  return Array.from({ length: n }, (_, i) => {
    const idx = base - (n - 1 - i);
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const monthLabel = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

export interface MonthStats {
  month: string;
  label: string;
  collectedCop: number;
  payments: number;
  withdrawnCop: number;
  newClients: number;
  newPlans: number;
}

export interface Renewal {
  subscriptionId: string;
  userId: string;
  customer: string;
  planName: string;
  nextMonth: number;
  months: number;
  amountCop: number;
  /** Fin del último mes pagado */
  dueAt: number;
  /** En pausa: hasta cuándo puede pagar antes de que el plan se cierre */
  graceEndsAt: number | null;
}

export interface BusinessAnalytics {
  generatedAt: number;
  months: MonthStats[];
  /** Recaudo de los últimos 12 meses por medio de pago, de mayor a menor */
  methods: { method: string; cop: number; payments: number }[];
  totals: { collectedCop: number; payments: number; averageTicketCop: number; withdrawnCop: number };
  /** Cuántos clientes llegan a cada paso (sin la cuenta de pruebas) */
  funnel: { registered: number; withProfile: number; paid: number; active: number };
  /** Mensualidades que se vencen en los próximos 7 días */
  dueSoon: Renewal[];
  /** Planes en pausa: terminó el mes y falta el pago del siguiente */
  paused: Renewal[];
  /** Planes que se cerraron por falta de pago en los últimos 30 días */
  closedUnpaid30d: number;
  /** Mensualidades que deberían entrar en los próximos 30 días (en pausa y por vencer) */
  expectedNext30Cop: number;
  capacity: { plantDailyKwh: number; contractedDailyKwh: number };
}

const RESERVING = new Set(["activa", "en_pausa", "en_revision"]);

export async function businessAnalytics(now = Date.now()): Promise<BusinessAnalytics> {
  const months = lastMonths(now, 12);
  const from = monthStartMs(months[0]);
  const at = sql<number>`coalesce(${ledgerTx.confirmedAt}, ${ledgerTx.createdAt})`;
  const [payments, withdrawals, users, profiles, subs, config, contracted] = await Promise.all([
    db
      .select({ at, amountCop: ledgerTx.amountCop, method: ledgerTx.method, userId: ledgerTx.userId })
      .from(ledgerTx)
      .where(and(eq(ledgerTx.kind, "plan_mes"), eq(ledgerTx.status, "confirmada"), collectedWhere())),
    db
      .select({ at, amountCop: ledgerTx.amountCop })
      .from(ledgerTx)
      .where(and(eq(ledgerTx.kind, "retiro"), eq(ledgerTx.status, "confirmada"))),
    db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }).from(user),
    db.select().from(companyProfile),
    listAllSubscriptions(),
    readConfig(),
    contractedDailyKwh(now),
  ]);

  // La cuenta de pruebas no es un cliente.
  const demo = new Set(users.filter((u) => u.email.toLowerCase() === env.demoEmail).map((u) => u.id));
  const clients = users.filter((u) => !demo.has(u.id));
  const profileOf = new Map(profiles.map((p) => [p.userId, p]));
  const customer = (userId: string) => {
    const p = profileOf.get(userId);
    return p?.companyName || p?.fullName || users.find((u) => u.id === userId)?.name || "Cliente";
  };

  const byMonth = new Map<string, MonthStats>(
    months.map((m) => [m, { month: m, label: monthLabel(m), collectedCop: 0, payments: 0, withdrawnCop: 0, newClients: 0, newPlans: 0 }]),
  );
  const methods = new Map<string, { method: string; cop: number; payments: number }>();
  for (const p of payments) {
    if (p.at < from) continue;
    const m = byMonth.get(monthKey(p.at));
    if (m) {
      m.collectedCop += p.amountCop;
      m.payments += 1;
    }
    const key = p.method ?? "otro";
    const row = methods.get(key) ?? { method: key, cop: 0, payments: 0 };
    row.cop += p.amountCop;
    row.payments += 1;
    methods.set(key, row);
  }
  for (const w of withdrawals) {
    const m = w.at >= from ? byMonth.get(monthKey(w.at)) : undefined;
    if (m) m.withdrawnCop += w.amountCop;
  }
  for (const u of clients) {
    const m = byMonth.get(monthKey(u.createdAt.getTime()));
    if (m) m.newClients += 1;
  }

  const { solar, plantDailyKwh } = config;
  const plans = subs.map((s) => ({ userId: s.userId, dto: toSubscriptionDTO(s, solar, now) }));
  // Un plan nuevo cuenta en el mes en que empezó su primer mes pagado.
  for (const { dto } of plans) {
    const first = dto.periods.length ? Math.min(...dto.periods.map((p) => p.startsAt)) : null;
    const m = first == null ? undefined : byMonth.get(monthKey(first));
    if (m) m.newPlans += 1;
  }

  const renewal = (userId: string, dto: (typeof plans)[number]["dto"]): Renewal => ({
    subscriptionId: dto.id,
    userId,
    customer: customer(userId),
    planName: dto.planName,
    nextMonth: dto.paidMonths + 1,
    months: dto.months,
    amountCop: dto.monthlyCop,
    dueAt: dto.paidUntil,
    graceEndsAt: dto.graceEndsAt,
  });
  const pending = plans.filter(({ dto }) => dto.paidMonths < dto.months);
  const dueSoon = pending
    .filter(({ dto }) => dto.state === "activa" && dto.paidUntil - now <= 7 * DAY_MS)
    .map(({ userId, dto }) => renewal(userId, dto))
    .sort((a, b) => a.dueAt - b.dueAt);
  const paused = pending
    .filter(({ dto }) => dto.state === "en_pausa")
    .map(({ userId, dto }) => renewal(userId, dto))
    .sort((a, b) => (a.graceEndsAt ?? a.dueAt) - (b.graceEndsAt ?? b.dueAt));
  const expectedNext30Cop = pending
    .filter(({ dto }) => (dto.state === "activa" || dto.state === "en_pausa") && dto.paidUntil - now <= 30 * DAY_MS)
    .reduce((s, { dto }) => s + dto.monthlyCop, 0);
  // Un plan vencido se cerró cuando terminó la gracia después del último mes pagado.
  const closedUnpaid30d = plans.filter(({ dto }) => dto.state === "vencida" && now - (dto.paidUntil + GRACE_MS) <= 30 * DAY_MS).length;

  const recent = payments.filter((p) => p.at >= from);
  const collectedCop = recent.reduce((s, p) => s + p.amountCop, 0);
  const isClient = (id: string) => !demo.has(id);
  return {
    generatedAt: now,
    months: [...byMonth.values()],
    methods: [...methods.values()].sort((a, b) => b.cop - a.cop),
    totals: {
      collectedCop,
      payments: recent.length,
      averageTicketCop: recent.length ? Math.round(collectedCop / recent.length) : 0,
      withdrawnCop: [...byMonth.values()].reduce((s, m) => s + m.withdrawnCop, 0),
    },
    funnel: {
      registered: clients.length,
      withProfile: clients.filter((u) => {
        const p = profileOf.get(u.id);
        return !!p && p.termsVersion === TERMS_VERSION && p.termsAcceptedAt != null && hasPersonalDetails(p);
      }).length,
      paid: new Set(payments.map((p) => p.userId).filter(isClient)).size,
      active: new Set(plans.filter(({ dto }) => RESERVING.has(dto.state)).map(({ userId }) => userId).filter(isClient)).size,
    },
    dueSoon,
    paused,
    closedUnpaid30d,
    expectedNext30Cop,
    // El mismo cálculo con el que se venden los planes (lib/plans/service).
    capacity: { plantDailyKwh, contractedDailyKwh: contracted },
  };
}
