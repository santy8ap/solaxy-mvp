import type { SolarDay } from "@/config/solar";
import { DAY_MS, dayStartMs, localDayIndex } from "@/lib/time";
import { activePeriod, energyBetween, generatedKwh, todayKwh, type Period } from "./plan-math";

/** Lo mínimo de un plan para calcular su energía y su dinero. */
export interface PlanForSummary {
  dailyKwh: number;
  priceCopPerKwh: number;
  saleCopPerKwh: number;
  periods: readonly Period[];
}

/**
 * Energía y dinero de un conjunto de planes en el instante `now`. Puro e isomórfico:
 * el servidor calcula el saldo con esto y el navegador mueve los contadores entre una consulta y otra.
 */
export function summarize(plans: readonly PlanForSummary[], solar: SolarDay, now: number) {
  let kwh = 0;
  let today = 0;
  let sold = 0;
  let cost = 0;
  let dailyKwh = 0;
  let dailyProfit = 0;
  for (const p of plans) {
    const g = generatedKwh(solar, p.dailyKwh, p.periods, now);
    kwh += g;
    today += todayKwh(solar, p.dailyKwh, p.periods, now);
    sold += g * p.saleCopPerKwh;
    cost += g * p.priceCopPerKwh;
    if (activePeriod(p.periods, now)) {
      dailyKwh += p.dailyKwh;
      dailyProfit += p.dailyKwh * (p.saleCopPerKwh - p.priceCopPerKwh);
    }
  }
  return { generatedKwh: kwh, todayKwh: today, soldCop: sold, costCop: cost, profitCop: sold - cost, dailyKwh, dailyProfitCop: dailyProfit };
}

/** Lo que rindieron los planes en un día. */
export interface DayReturn {
  /** Medianoche (hora de Colombia) con la que empieza el día */
  dayStart: number;
  kwh: number;
  soldCop: number;
  profitCop: number;
  /** El día en curso: sus cifras siguen creciendo */
  today: boolean;
}

/**
 * Rendimiento día a día, con hoy primero: hasta `days` días, sin pasar del día del primer pago.
 * Un día sin mes pagado (plan en pausa) aparece con cero.
 */
export function dailyReturns(plans: readonly PlanForSummary[], solar: SolarDay, now: number, days = 7): DayReturn[] {
  const starts = plans.flatMap((p) => p.periods.map((x) => x.startsAt));
  if (!starts.length) return [];
  const firstDay = localDayIndex(Math.min(...starts));
  const todayIndex = localDayIndex(now);
  const rows: DayReturn[] = [];
  for (let day = todayIndex; day >= firstDay && rows.length < days; day--) {
    const start = dayStartMs(day);
    const end = Math.min(now, start + DAY_MS);
    let kwh = 0;
    let sold = 0;
    let cost = 0;
    for (const p of plans) {
      for (const period of p.periods) {
        const g = energyBetween(solar, p.dailyKwh, Math.max(start, period.startsAt), Math.min(end, period.endsAt));
        kwh += g;
        sold += g * p.saleCopPerKwh;
        cost += g * p.priceCopPerKwh;
      }
    }
    rows.push({ dayStart: start, kwh, soldCop: sold, profitCop: sold - cost, today: day === todayIndex });
  }
  return rows;
}
