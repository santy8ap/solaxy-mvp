import { describe, expect, it } from "vitest";
import { projectedSolarKw, solarClockAt } from "./solar-clock";
import { bogotaMs } from "./sim/time";

describe("solar clock projection", () => {
  it("is zero outside 06:00–19:00, including both endpoints", () => {
    for (const h of [0, 5.99, 6, 19, 23.99, NaN, Infinity])
      expect(projectedSolarKw(h)).toBe(0);
  });
  it("peaks at 8,000 kW at 12:30 and stays bounded and symmetric", () => {
    expect(projectedSolarKw(12.5)).toBe(8000);
    for (let h = 6; h <= 19; h += 0.125) {
      expect(projectedSolarKw(h)).toBeGreaterThanOrEqual(0);
      expect(projectedSolarKw(h)).toBeLessThanOrEqual(8000);
      expect(projectedSolarKw(h)).toBeCloseTo(projectedSolarKw(25 - h), 8);
    }
  });
  it("uses Colombia time regardless of the browser time zone", () => {
    expect(solarClockAt(bogotaMs(2026, 11, 10, 12, 30))).toEqual({
      hour: 12.5,
      active: true,
      kw: 8000,
    });
    expect(solarClockAt(bogotaMs(2026, 11, 10, 19)).active).toBe(false);
    expect(solarClockAt(bogotaMs(2026, 11, 11, 0)).kw).toBe(0);
  });
});
