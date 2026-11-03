import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { asc } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PLANT } from "@/config/plant";
import { createDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { telemetry } from "@/lib/db/schema";
import { DEFAULT_SETTINGS, econFrom, specFrom, validateSettings } from "@/lib/plant-settings";
import { DAY_MS, HOUR_MS, dayStartMs, localDayIndex } from "@/lib/sim";
import { ensureTelemetry, resetEnsureCache } from "@/lib/telemetry/service";

describe("configuración de la planta", () => {
  it("la capacidad escala la potencia AC, los paneles y los inversores", () => {
    const spec = specFrom({ ...DEFAULT_SETTINGS, capacityKwp: 3000 });
    expect(spec.capacityKwp).toBe(3000);
    expect(spec.acCapacityKw).toBe(Math.round(PLANT.acCapacityKw * 1.5));
    expect(spec.inverterCount).toBe(15);
    expect(spec.lat).toBe(PLANT.lat);
  });

  it("la comisión define la fracción neta y las tarifas pasan a la economía", () => {
    const econ = econFrom({ ...DEFAULT_SETTINGS, commissionPct: 20, tariffDayCop: 600, tariffPeakCop: 900, pricePerKwCop: 5_000_000 });
    expect(econ.netFactor).toBeCloseTo(0.8, 9);
    expect(econ.tariffDayCopPerKwh).toBe(600);
    expect(econ.tariffPeakCopPerKwh).toBe(900);
    expect(econ.pricePerKwCop).toBe(5_000_000);
  });

  it("no deja bajar la capacidad por debajo de los kW vendidos", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, capacityKwp: 1000 }, { soldKw: 1162 })).toMatch(/vendidos/);
    expect(validateSettings({ ...DEFAULT_SETTINGS, capacityKwp: 2500 }, { soldKw: 1162 })).toBeNull();
  });

  it("rechaza valores fuera de rango", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, commissionPct: 80 }, { soldKw: 0 })).toMatch(/comisión/i);
    expect(validateSettings({ ...DEFAULT_SETTINGS, pricePerKwCop: 1000 }, { soldKw: 0 })).toMatch(/precio/i);
    expect(validateSettings({ ...DEFAULT_SETTINGS, tariffDayCop: 0 }, { soldKw: 0 })).toMatch(/tarifa/i);
    expect(validateSettings({ ...DEFAULT_SETTINGS, name: "" }, { soldKw: 0 })).toMatch(/nombre/i);
  });

  it("las tarifas nuevas solo aplican a los intervalos nuevos: el historial no cambia", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solaxy-set-"));
    const { client, db } = createDb(`file:${path.join(dir, "s.db")}`);
    await migrate(client);
    resetEnsureCache();
    const commissioned = dayStartMs(localDayIndex(Date.UTC(2026, 10, 1)));
    const t1 = commissioned + DAY_MS + 12 * HOUR_MS;
    const t2 = t1 + 2 * HOUR_MS;
    const before = DEFAULT_SETTINGS;
    const after = { ...DEFAULT_SETTINGS, tariffDayCop: 700 };
    await ensureTelemetry(db, specFrom(before), commissioned, t1, econFrom(before));
    await ensureTelemetry(db, specFrom(after), commissioned, t2, econFrom(after));
    const rows = await db.select().from(telemetry).orderBy(asc(telemetry.ts));
    const old = rows.filter((r) => r.ts < t1 - 15 * 60_000);
    const fresh = rows.filter((r) => r.ts >= t1);
    // El historial conserva sus tarifas (560 de día, 820 en la hora pico); ninguna fila vieja cambia.
    expect(old.length).toBeGreaterThan(0);
    expect(old.every((r) => r.tariffCop === 560 || r.tariffCop === 820)).toBe(true);
    // Los intervalos nuevos (12:00 a 14:00, horario de día) usan la tarifa nueva.
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((r) => r.tariffCop === 700)).toBe(true);
  });
});
