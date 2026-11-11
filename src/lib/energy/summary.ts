import type { SolarDay } from "@/config/solar";
import { activePeriod, generatedKwh, todayKwh, type Period } from "./plan-math";

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
