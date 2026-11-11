import { describe, expect, it } from "vitest";
import { SOLAR } from "@/config/solar";
import { PERIOD_MS, type Period } from "@/lib/energy/plan-math";
import { dailyReturns, summarize, type PlanForSummary } from "@/lib/energy/summary";
import { DAY_MS, bogotaMs } from "@/lib/time";

const at = (d: number, h = 0, m = 0) => bogotaMs(2026, 11, d, h, m);
const period = (index: number, startsAt: number): Period => ({ index, startsAt, endsAt: startsAt + PERIOD_MS });
/** Plan 360: 4.000 kWh al día, comprado a $ 340 y vendido a $ 400. */
const plan = (periods: Period[], dailyKwh = 4000): PlanForSummary => ({ dailyKwh, priceCopPerKwh: 340, saleCopPerKwh: 400, periods });

describe("resumen de energía y dinero", () => {
  it("un día completo de un plan rinde su energía diaria, vendida al precio de venta", () => {
    const s = summarize([plan([period(1, at(10, 0))])], SOLAR, at(11, 0));
    expect(s.generatedKwh).toBeCloseTo(4000, 6);
    expect(s.soldCop).toBeCloseTo(1_600_000, 3);
    expect(s.profitCop).toBeCloseTo(240_000, 3);
    expect(s.dailyProfitCop).toBe(240_000);
  });
});

describe("rendimientos día a día", () => {
  // Comprado el día 10 a las 12:30, la mitad del día solar: ese día solo rinde la mitad.
  const plans = [plan([period(1, at(10, 12, 30))])];

  it("lista los días desde la compra, con hoy primero", () => {
    const rows = dailyReturns(plans, SOLAR, at(12, 12, 30));
    expect(rows.map((r) => r.dayStart)).toEqual([at(12), at(11), at(10)]);
    expect(rows.map((r) => r.today)).toEqual([true, false, false]);
  });

  it("cada día trae su energía, su venta y su utilidad", () => {
    const [today, yesterday, first] = dailyReturns(plans, SOLAR, at(12, 12, 30));
    expect(yesterday.kwh).toBeCloseTo(4000, 6);
    expect(yesterday.soldCop).toBeCloseTo(1_600_000, 3);
    expect(yesterday.profitCop).toBeCloseTo(240_000, 3);
    expect(first.kwh).toBeCloseTo(2000, 6);
    expect(today.kwh).toBeCloseTo(2000, 6);
    expect(today.profitCop).toBeCloseTo(120_000, 3);
  });

  it("la suma de los días es la energía generada en total", () => {
    const now = at(14, 15, 47);
    const total = summarize(plans, SOLAR, now);
    const rows = dailyReturns(plans, SOLAR, now, 30);
    expect(rows.reduce((s, r) => s + r.kwh, 0)).toBeCloseTo(total.generatedKwh, 6);
    expect(rows.reduce((s, r) => s + r.profitCop, 0)).toBeCloseTo(total.profitCop, 3);
  });

  it("no pasa del número de días pedido", () => {
    expect(dailyReturns(plans, SOLAR, at(25, 9), 7)).toHaveLength(7);
  });

  it("suma varios planes en el mismo día", () => {
    const two = [plan([period(1, at(10, 0))]), plan([period(1, at(10, 0))], 2000)];
    const rows = dailyReturns(two, SOLAR, at(11, 23));
    expect(rows[1].kwh).toBeCloseTo(6000, 6);
  });

  it("los días en pausa aparecen con cero", () => {
    // El mes terminó hace dos días y no se ha pagado el siguiente.
    const start = at(1, 0);
    const paused = [plan([{ index: 1, startsAt: start, endsAt: start + 5 * DAY_MS }])];
    const rows = dailyReturns(paused, SOLAR, at(8, 12), 4);
    expect(rows.map((r) => Math.round(r.kwh))).toEqual([0, 0, 0, 4000]);
  });

  it("sin planes pagados no hay días que mostrar", () => {
    expect(dailyReturns([], SOLAR, at(12, 12))).toEqual([]);
    expect(dailyReturns([plan([])], SOLAR, at(12, 12))).toEqual([]);
  });
});
