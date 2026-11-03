import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PLANT } from "@/config/plant";
import { createDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { telemetry } from "@/lib/db/schema";
import { DAY_MS, HOUR_MS, INTERVAL_MS, dayStartMs, intervalAt, localDayIndex } from "@/lib/sim";
import { buildCurves, ensureTelemetry, resetEnsureCache } from "@/lib/telemetry/service";
import { asc, count } from "drizzle-orm";

const commissioned = dayStartMs(localDayIndex(Date.UTC(2026, 10, 1)));
const now = commissioned + 3 * DAY_MS + 10 * HOUR_MS + 7 * 60_000;

let db: Db;
beforeEach(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "solaxy-test-"));
  const created = createDb(`file:${path.join(dir, "test.db")}`);
  db = created.db;
  await migrate(created.client);
  resetEnsureCache();
});

async function rowCount() {
  const [r] = await db.select({ n: count() }).from(telemetry);
  return r.n;
}

describe("relleno de telemetría", () => {
  it("guarda todos los intervalos completos desde la puesta en marcha hasta ahora", async () => {
    await ensureTelemetry(db, PLANT, commissioned, now);
    expect(await rowCount()).toBe(3 * 96 + 40);
  });

  it("es idempotente", async () => {
    await ensureTelemetry(db, PLANT, commissioned, now);
    resetEnsureCache();
    const inserted = await ensureTelemetry(db, PLANT, commissioned, now);
    expect(inserted).toBe(0);
    expect(await rowCount()).toBe(3 * 96 + 40);
  });

  it("continúa los acumulados al agregar intervalos nuevos", async () => {
    await ensureTelemetry(db, PLANT, commissioned, now);
    const inserted = await ensureTelemetry(db, PLANT, commissioned, now + 2 * HOUR_MS);
    expect(inserted).toBe(8);
    const rows = await db.select().from(telemetry).orderBy(asc(telemetry.ts));
    let cum = 0;
    for (const r of rows) {
      cum += r.netCop / PLANT.capacityKwp;
      expect(r.cumNetPerKwp).toBeCloseTo(cum, 6);
    }
  });
});

describe("curva de ingreso acumulado C(t)", () => {
  it("vale 0 antes de la puesta en marcha", async () => {
    await ensureTelemetry(db, PLANT, commissioned, now);
    const { net } = await buildCurves(db, PLANT, [commissioned - HOUR_MS], now);
    expect(net.at(commissioned - HOUR_MS)).toBe(0);
  });

  it("en este instante coincide con el modelo, incluyendo el intervalo en curso", async () => {
    await ensureTelemetry(db, PLANT, commissioned, now);
    const { net } = await buildCurves(db, PLANT, [now], now);
    let expected = 0;
    for (let t = commissioned; t + INTERVAL_MS <= now; t += INTERVAL_MS) {
      expected += intervalAt(PLANT, t).netCop / PLANT.capacityKwp;
    }
    const current = intervalAt(PLANT, now);
    expected += (current.netCop / PLANT.capacityKwp) * ((now - current.ts) / INTERVAL_MS);
    expect(net.at(now)).toBeCloseTo(expected, 6);
  });

  it("en un instante pasado interpola dentro de su intervalo", async () => {
    await ensureTelemetry(db, PLANT, commissioned, now);
    const t = commissioned + DAY_MS + 12 * HOUR_MS + 5 * 60_000;
    const { net } = await buildCurves(db, PLANT, [t], now);
    let expected = 0;
    for (let s = commissioned; s + INTERVAL_MS <= t; s += INTERVAL_MS) {
      expected += intervalAt(PLANT, s).netCop / PLANT.capacityKwp;
    }
    expected += (intervalAt(PLANT, t).netCop / PLANT.capacityKwp) * (5 / 15);
    expect(net.at(t)).toBeCloseTo(expected, 6);
  });
});
