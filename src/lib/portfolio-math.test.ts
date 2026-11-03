import { describe, expect, it } from "vitest";
import { dailyEarnings, earningsAt, kwOwnedAt } from "@/lib/portfolio-math";
import { DAY_MS, dayStartMs, localDayIndex } from "@/lib/sim";

/** Curva sintética: cada kWp gana 1 COP por segundo. */
const linear = { at: (ts: number) => ts / 1000 };

describe("ganancias de un portafolio", () => {
  it("gana kW × (C(ahora) − C(compra)) desde el momento de la compra", () => {
    const entries = [{ kwDelta: 2, ts: 1_000 }];
    expect(earningsAt(entries, linear, 5_000)).toBeCloseTo(8, 9);
  });

  it("una venta corta las ganancias de los kW vendidos desde ese momento", () => {
    const entries = [
      { kwDelta: 2, ts: 1_000 },
      { kwDelta: -1, ts: 3_000 },
    ];
    expect(earningsAt(entries, linear, 5_000)).toBeCloseTo(6, 9);
    expect(kwOwnedAt(entries, 5_000)).toBe(1);
  });

  it("ignora movimientos posteriores al instante consultado", () => {
    const entries = [
      { kwDelta: 2, ts: 1_000 },
      { kwDelta: 5, ts: 6_000 },
    ];
    expect(earningsAt(entries, linear, 5_000)).toBeCloseTo(8, 9);
    expect(kwOwnedAt(entries, 5_000)).toBe(2);
  });

  it("la suma de las ganancias diarias es igual a la ganancia total", () => {
    const now = dayStartMs(localDayIndex(Date.UTC(2026, 10, 4))) + 13.5 * 3_600_000;
    const entries = [
      { kwDelta: 7, ts: now - 9.3 * DAY_MS },
      { kwDelta: 5, ts: now - 2.6 * DAY_MS },
      { kwDelta: -1.5, ts: now - 1.1 * DAY_MS },
    ];
    const lastDay = localDayIndex(now);
    const days = Array.from({ length: 12 }, (_, k) => lastDay - 11 + k);
    const daily = dailyEarnings(entries, linear, days, now);
    const sum = daily.reduce((s, d) => s + d.earnedCop, 0);
    expect(sum).toBeCloseTo(earningsAt(entries, linear, now), 6);
    expect(daily.at(-1)?.kw).toBeCloseTo(10.5, 9);
    expect(daily[0].earnedCop).toBe(0);
  });
});
