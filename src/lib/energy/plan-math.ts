import { PLAN_MONTHS } from "@/config/plans";
import type { SolarDay } from "@/config/solar";
import { DAY_MS, dayStartMs, localDayIndex } from "@/lib/time";
import { dayFraction, shape, solarHours, solarProgress } from "./solar-day";

/** Economía de los planes y energía generada. Puro e isomórfico. */

export const DAYS_PER_MONTH = 30;
/** Cada pago mensual activa un periodo de 30 días. */
export const PERIOD_MS = DAYS_PER_MONTH * DAY_MS;
/** Días que un plan puede quedar en pausa por falta de pago antes de cerrarse. */
export const GRACE_DAYS = 15;
export const GRACE_MS = GRACE_DAYS * DAY_MS;

export interface PlanEconomics {
  months: number;
  dailyKwh: number;
  monthlyKwh: number;
  /** Lo que se paga cada mes y en todo el contrato (COP) */
  monthlyCop: number;
  totalCop: number;
  /** Lo que se recibe por la venta de la energía (COP) */
  dailySaleCop: number;
  monthlySaleCop: number;
  totalSaleCop: number;
  profitPerKwhCop: number;
  /** Utilidad sobre el precio del plan (fracción): (venta − precio) ÷ precio */
  profitPct: number;
  dailyProfitCop: number;
  monthlyProfitCop: number;
  totalProfitCop: number;
}

export function planEconomics(
  plan: { totalKwh: number; priceCopPerKwh: number },
  saleCopPerKwh: number,
  months = PLAN_MONTHS,
): PlanEconomics {
  const monthlyKwh = plan.totalKwh / months;
  const dailyKwh = monthlyKwh / DAYS_PER_MONTH;
  const profitPerKwhCop = saleCopPerKwh - plan.priceCopPerKwh;
  const monthlyCop = Math.round(monthlyKwh * plan.priceCopPerKwh);
  const monthlySaleCop = Math.round(monthlyKwh * saleCopPerKwh);
  return {
    months,
    dailyKwh,
    monthlyKwh,
    monthlyCop,
    totalCop: Math.round(plan.totalKwh * plan.priceCopPerKwh),
    dailySaleCop: Math.round(dailyKwh * saleCopPerKwh),
    monthlySaleCop,
    totalSaleCop: Math.round(plan.totalKwh * saleCopPerKwh),
    profitPerKwhCop,
    profitPct: profitPerKwhCop / plan.priceCopPerKwh,
    dailyProfitCop: Math.round(dailyKwh * profitPerKwhCop),
    monthlyProfitCop: monthlySaleCop - monthlyCop,
    totalProfitCop: Math.round(plan.totalKwh * profitPerKwhCop),
  };
}

/** Un mes pagado: 30 días de energía. */
export interface Period {
  index: number;
  startsAt: number;
  endsAt: number;
}

/** kWh que genera un plan de `dailyKwh` entre dos instantes. */
export function energyBetween(
  solar: SolarDay,
  dailyKwh: number,
  from: number,
  to: number,
) {
  if (to <= from) return 0;
  return dailyKwh * (solarProgress(solar, to) - solarProgress(solar, from));
}

/** kWh generados hasta `now`: solo cuenta el tiempo dentro de los periodos pagados. */
export function generatedKwh(
  solar: SolarDay,
  dailyKwh: number,
  periods: readonly Period[],
  now: number,
) {
  let kwh = 0;
  for (const p of periods)
    kwh += energyBetween(solar, dailyKwh, p.startsAt, Math.min(now, p.endsAt));
  return kwh;
}

/** kWh generados hoy (desde la medianoche local). */
export function todayKwh(
  solar: SolarDay,
  dailyKwh: number,
  periods: readonly Period[],
  now: number,
) {
  const midnight = dayStartMs(localDayIndex(now));
  let kwh = 0;
  for (const p of periods)
    kwh += energyBetween(
      solar,
      dailyKwh,
      Math.max(midnight, p.startsAt),
      Math.min(now, p.endsAt),
    );
  return kwh;
}

export function activePeriod(periods: readonly Period[], now: number) {
  return periods.find((p) => p.startsAt <= now && now < p.endsAt) ?? null;
}

/** Potencia del plan en este instante (kW): la campana, a la escala de sus kWh diarios. */
export function userPowerKw(
  solar: SolarDay,
  dailyKwh: number,
  periods: readonly Period[],
  now: number,
) {
  if (!activePeriod(periods, now)) return 0;
  return (
    (dailyKwh * shape(dayFraction(solar, now)) * Math.PI) /
    (2 * solarHours(solar))
  );
}

export type SubscriptionState =
  | "borrador"
  | "activa"
  | "en_pausa"
  | "completada"
  | "vencida"
  | "cancelada"
  | "en_revision";

/**
 * Estado de un plan, derivado de sus periodos:
 * - borrador: todavía no se confirma el primer pago;
 * - activa: corre un periodo pagado;
 * - en_pausa: terminó el periodo y falta pagar el mes siguiente (hasta 15 días);
 * - vencida: pasaron los 15 días sin pagar: el plan se cerró;
 * - completada: se pagaron y terminaron todos los meses.
 */
export function subscriptionState(
  sub: { months: number; cancelledAt?: number | null },
  periods: readonly Period[],
  now: number,
): SubscriptionState {
  if (sub.cancelledAt != null) return "cancelada";
  if (!periods.length) return "borrador";
  if (activePeriod(periods, now)) return "activa";
  const lastEnd = Math.max(...periods.map((p) => p.endsAt));
  if (now < lastEnd) return "activa";
  if (periods.length >= sub.months) return "completada";
  return now <= lastEnd + GRACE_MS ? "en_pausa" : "vencida";
}

/** ¿El plan ocupa cupo de la planta? (activo o en pausa esperando el pago) */
export function reservesCapacity(state: SubscriptionState) {
  return state === "activa" || state === "en_pausa" || state === "en_revision";
}

/** Ventana del periodo que activaría un pago confirmado en `now`. */
export function nextPeriodWindow(
  periods: readonly Period[],
  now: number,
): Period {
  const lastEnd = periods.length
    ? Math.max(...periods.map((p) => p.endsAt))
    : now;
  const startsAt = Math.max(now, lastEnd);
  return { index: periods.length + 1, startsAt, endsAt: startsAt + PERIOD_MS };
}
