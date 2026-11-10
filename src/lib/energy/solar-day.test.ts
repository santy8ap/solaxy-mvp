import { describe, expect, it } from "vitest";
import { SOLAR } from "@/config/solar";
import { cumulative, dayFraction, nextSunriseMs, plantDailyKwh, plantPowerKw, shape, solarHours, solarProgress } from "@/lib/energy/solar-day";
import { DAY_MS, HOUR_MS, bogotaMs } from "@/lib/time";

const at = (h: number, m = 0) => bogotaMs(2026, 11, 10, h, m);

describe("reloj solar: de 6 a. m. a 7 p. m., máximo 8.000 kW", () => {
  it("la configuración es la que pidió el cliente", () => {
    expect(SOLAR).toEqual({ startHour: 6, endHour: 19, peakKw: 8000 });
    expect(solarHours(SOLAR)).toBe(13);
  });

  it("antes de las 6 a. m. y después de las 7 p. m. no hay generación", () => {
    for (const ts of [at(0), at(5, 59), at(19), at(23, 59)]) expect(plantPowerKw(SOLAR, ts)).toBe(0);
    expect(dayFraction(SOLAR, at(3))).toBe(0);
    expect(dayFraction(SOLAR, at(22))).toBe(1);
  });

  it("el máximo es de 8.000 kW a la mitad del día solar (12:30 p. m.) y nunca se supera", () => {
    expect(plantPowerKw(SOLAR, at(12, 30))).toBeCloseTo(8000, 6);
    for (let h = 6; h <= 19; h += 0.25) expect(plantPowerKw(SOLAR, at(Math.floor(h), (h % 1) * 60))).toBeLessThanOrEqual(8000);
  });

  it("la campana es simétrica y sube hasta el mediodía solar", () => {
    expect(plantPowerKw(SOLAR, at(9))).toBeCloseTo(plantPowerKw(SOLAR, at(16)), 6);
    expect(plantPowerKw(SOLAR, at(8))).toBeLessThan(plantPowerKw(SOLAR, at(10)));
    expect(shape(0)).toBe(0);
    expect(shape(0.5)).toBe(1);
    expect(shape(1.2)).toBe(0);
  });

  it("a la mitad del día solar va el 50 % de la energía del día", () => {
    expect(cumulative(0)).toBe(0);
    expect(cumulative(0.5)).toBeCloseTo(0.5, 12);
    expect(cumulative(1)).toBeCloseTo(1, 12);
    expect(cumulative(dayFraction(SOLAR, at(12, 30)))).toBeCloseTo(0.5, 12);
  });

  it("la energía diaria de la planta es el área bajo la campana", () => {
    // Integral numérica de la potencia, minuto a minuto.
    let kwh = 0;
    for (let m = 0; m < 24 * 60; m++) kwh += plantPowerKw(SOLAR, at(0) + (m + 0.5) * 60_000) / 60;
    expect(plantDailyKwh(SOLAR)).toBeCloseTo((8000 * 13 * 2) / Math.PI, 6);
    expect(kwh).toBeCloseTo(plantDailyKwh(SOLAR), 0);
  });

  it("el progreso solar avanza exactamente 1 por cada día y es continuo en la medianoche", () => {
    const t = at(10, 17);
    expect(solarProgress(SOLAR, t + DAY_MS) - solarProgress(SOLAR, t)).toBeCloseTo(1, 9);
    expect(solarProgress(SOLAR, at(23, 59)) - solarProgress(SOLAR, at(19))).toBe(0);
    expect(solarProgress(SOLAR, at(0) + DAY_MS) - solarProgress(SOLAR, at(23, 59))).toBeCloseTo(0, 12);
    expect(solarProgress(SOLAR, at(12)) - solarProgress(SOLAR, at(11))).toBeGreaterThan(0);
  });

  it("dice cuándo vuelve a generar", () => {
    expect(nextSunriseMs(SOLAR, at(3))).toBe(at(6));
    expect(nextSunriseMs(SOLAR, at(21))).toBe(at(6) + DAY_MS);
    expect(nextSunriseMs(SOLAR, at(10))).toBe(at(6) + DAY_MS);
    expect(nextSunriseMs(SOLAR, at(6)) - at(6)).toBe(24 * HOUR_MS);
  });
});
