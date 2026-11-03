import { describe, expect, it } from "vitest";
import { ECONOMICS } from "@/config/economics";
import { PLANT } from "@/config/plant";
import { bogotaMs, dayProfile, instantReading, localDayIndex, localHour } from "@/lib/sim";

const NOV_4 = bogotaMs(2026, 11, 4);

describe("motor solar", () => {
  it("no produce energía solar en la madrugada", () => {
    const r = instantReading(PLANT, bogotaMs(2026, 11, 4, 2));
    expect(r.solarKw).toBe(0);
    expect(r.irradiance).toBe(0);
  });

  it("produce al mediodía sin superar la capacidad AC", () => {
    const r = instantReading(PLANT, bogotaMs(2026, 11, 4, 12));
    expect(r.solarKw).toBeGreaterThan(0);
    expect(r.solarKw).toBeLessThanOrEqual(PLANT.acCapacityKw);
  });

  it("genera entre 2,5 y 5,5 kWh por kWp al día durante 60 días", () => {
    const first = localDayIndex(NOV_4);
    for (let d = 0; d < 60; d++) {
      const profile = dayProfile(PLANT, first - d);
      const solarKwh = profile.reduce((s, i) => s + i.solarKw * 0.25, 0);
      const perKwp = solarKwh / PLANT.capacityKwp;
      expect(perKwp).toBeGreaterThan(2.5);
      expect(perKwp).toBeLessThan(5.5);
    }
  });

  it("es determinista para el mismo instante", () => {
    const t = bogotaMs(2026, 11, 4, 10, 17);
    expect(instantReading(PLANT, t)).toEqual(instantReading(PLANT, t));
  });

  it("varía levemente entre lecturas de 2 segundos (se ve en vivo)", () => {
    const t = bogotaMs(2026, 11, 4, 11);
    const a = instantReading(PLANT, t).solarKw;
    const b = instantReading(PLANT, t + 2000).solarKw;
    expect(a).not.toBe(b);
    expect(Math.abs(a - b) / a).toBeLessThan(0.05);
  });
});

describe("batería", () => {
  const days = Array.from({ length: 30 }, (_, k) => localDayIndex(NOV_4) - k);

  it("solo carga entre 9:30 y 15:00 y solo descarga entre 18:00 y 22:00", () => {
    for (const day of days) {
      for (const i of dayProfile(PLANT, day)) {
        const h = localHour(i.ts);
        if (i.chargeKw > 0) {
          expect(h).toBeGreaterThanOrEqual(9.5);
          expect(h).toBeLessThan(15);
        }
        if (i.dischargeKw > 0) {
          expect(h).toBeGreaterThanOrEqual(18);
          expect(h).toBeLessThan(22);
        }
      }
    }
  });

  it("mantiene el estado de carga dentro de sus límites", () => {
    const { minSoc, maxSoc } = PLANT.battery;
    for (const day of days) {
      for (const i of dayProfile(PLANT, day)) {
        expect(i.socPct).toBeGreaterThanOrEqual(minSoc * 100 - 1e-9);
        expect(i.socPct).toBeLessThanOrEqual(maxSoc * 100 + 1e-9);
      }
    }
  });

  it("entrega energía a las 7 pm (hora de la reunión)", () => {
    for (const day of days) {
      const t = bogotaMs(2026, 11, 4, 19) - (localDayIndex(NOV_4) - day) * 86_400_000;
      const r = instantReading(PLANT, t);
      expect(r.solarKw).toBe(0);
      expect(r.batteryKw).toBeGreaterThan(0);
      expect(r.deliveredKw).toBeGreaterThan(0);
    }
  });

  it("no descarga más energía de la que cargó (con eficiencias)", () => {
    const { chargeEff, dischargeEff } = PLANT.battery;
    for (const day of days) {
      const p = dayProfile(PLANT, day);
      const charged = p.reduce((s, i) => s + i.chargeKw * 0.25, 0);
      const discharged = p.reduce((s, i) => s + i.dischargeKw * 0.25, 0);
      expect(discharged).toBeLessThanOrEqual(charged * chargeEff * dischargeEff + 1e-6);
    }
  });

  it("la potencia entregada es solar − carga + descarga", () => {
    for (const i of dayProfile(PLANT, days[0])) {
      expect(i.deliveredKw).toBeCloseTo(i.solarKw - i.chargeKw + i.dischargeKw, 6);
    }
  });
});

describe("ingresos", () => {
  it("usa la tarifa pico entre 18:00 y 22:00 y la del día en el resto", () => {
    const p = dayProfile(PLANT, localDayIndex(NOV_4));
    for (const i of p) {
      const h = localHour(i.ts);
      const expected = h >= 18 && h < 22 ? ECONOMICS.tariffPeakCopPerKwh : ECONOMICS.tariffDayCopPerKwh;
      expect(i.tariffCopPerKwh).toBe(expected);
      expect(i.netCop).toBeCloseTo(i.deliveredKwh * expected * ECONOMICS.netFactor, 6);
    }
  });

  it("deja una rentabilidad anual estimada entre 13 % y 17 %", () => {
    const today = localDayIndex(NOV_4);
    let net = 0;
    for (let d = 0; d < 365; d++) net += dayProfile(PLANT, today - d).reduce((s, i) => s + i.netCop, 0);
    const yieldEa = net / PLANT.capacityKwp / ECONOMICS.pricePerKwCop;
    expect(yieldEa).toBeGreaterThan(0.13);
    expect(yieldEa).toBeLessThan(0.17);
  });
});
