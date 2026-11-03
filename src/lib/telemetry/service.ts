import { and, asc, desc, eq, gte, inArray, lte, min, sql } from "drizzle-orm";
import { ECONOMICS, type Economics } from "@/config/economics";
import type { PlantSpec } from "@/config/plant";
import type { Db } from "@/lib/db/client";
import { telemetry } from "@/lib/db/schema";
import type { CumulativeCurve } from "@/lib/portfolio-math";
import { INTERVAL_MS, intervalAt, intervalStart } from "@/lib/sim";

let lastEnsured = 0;
let inflight: Promise<number> | null = null;

/** Solo para pruebas: olvida qué intervalos ya se garantizaron. */
export function resetEnsureCache() {
  lastEnsured = 0;
  inflight = null;
}

function lastCompleteStart(now: number) {
  return intervalStart(now) - INTERVAL_MS;
}

/**
 * Guarda en la base de datos los intervalos de 15 min que falten, desde la puesta
 * en marcha hasta el último intervalo completo. No necesita cron: se llama al
 * consultar datos. Devuelve cuántas filas insertó.
 */
export async function ensureTelemetry(
  db: Db,
  spec: PlantSpec,
  commissionedAt: number,
  now: number,
  econ: Economics = ECONOMICS,
): Promise<number> {
  const target = lastCompleteStart(now);
  if (lastEnsured >= target) return 0;
  if (inflight) {
    await inflight;
    if (lastEnsured >= target) return 0;
  }
  inflight = fill(db, spec, econ, commissionedAt, target).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fill(db: Db, spec: PlantSpec, econ: Economics, commissionedAt: number, target: number): Promise<number> {
  const [last] = await db
    .select({ ts: telemetry.ts, cumKwh: telemetry.cumKwh, cumNetPerKwp: telemetry.cumNetPerKwp })
    .from(telemetry)
    .where(eq(telemetry.plantId, spec.id))
    .orderBy(desc(telemetry.ts))
    .limit(1);

  let ts = last ? last.ts + INTERVAL_MS : intervalStart(commissionedAt);
  let cumKwh = last?.cumKwh ?? 0;
  let cumNet = last?.cumNetPerKwp ?? 0;
  const rows: (typeof telemetry.$inferInsert)[] = [];
  for (; ts <= target; ts += INTERVAL_MS) {
    const i = intervalAt(spec, ts, econ);
    cumKwh += i.deliveredKwh;
    cumNet += i.netCop / spec.capacityKwp;
    rows.push({
      plantId: spec.id,
      ts,
      day: i.day,
      solarKw: i.solarKw,
      batteryKw: i.batteryKw,
      socPct: i.socPct,
      deliveredKwh: i.deliveredKwh,
      irradiance: i.irradiance,
      moduleTempC: i.moduleTempC,
      ambientTempC: i.ambientTempC,
      tariffCop: i.tariffCopPerKwh,
      netCop: i.netCop,
      cumKwh,
      cumNetPerKwp: cumNet,
    });
  }
  for (let k = 0; k < rows.length; k += 250) {
    await db.insert(telemetry).values(rows.slice(k, k + 250)).onConflictDoNothing();
  }
  lastEnsured = target;
  return rows.length;
}

type CurveRow = { ts: number; netCop: number; deliveredKwh: number; cumKwh: number; cumNetPerKwp: number };

export interface Curves {
  /** Ingreso neto acumulado por kWp (COP) */
  net: CumulativeCurve;
  /** Energía entregada acumulada por kWp (kWh) */
  energy: CumulativeCurve;
}

/**
 * Construye las curvas acumuladas C(t) para los instantes indicados (se consultan
 * de una vez en la base de datos). Consultar un instante no declarado es un error.
 */
export async function buildCurves(
  db: Db,
  spec: PlantSpec,
  timestamps: readonly number[],
  now: number,
  econ: Economics = ECONOMICS,
): Promise<Curves> {
  const target = lastCompleteStart(now);
  const starts = [...new Set(timestamps.map(intervalStart).filter((s) => s <= target))];
  const cols = {
    ts: telemetry.ts,
    netCop: telemetry.netCop,
    deliveredKwh: telemetry.deliveredKwh,
    cumKwh: telemetry.cumKwh,
    cumNetPerKwp: telemetry.cumNetPerKwp,
  };
  const rows: CurveRow[] = [];
  for (let k = 0; k < starts.length; k += 500) {
    rows.push(
      ...(await db
        .select(cols)
        .from(telemetry)
        .where(and(eq(telemetry.plantId, spec.id), inArray(telemetry.ts, starts.slice(k, k + 500))))),
    );
  }
  const [last] = await db
    .select(cols)
    .from(telemetry)
    .where(and(eq(telemetry.plantId, spec.id), lte(telemetry.ts, target)))
    .orderBy(desc(telemetry.ts))
    .limit(1);
  const [first] = await db.select({ ts: min(telemetry.ts) }).from(telemetry).where(eq(telemetry.plantId, spec.id));
  const firstTs = first?.ts ?? Number.POSITIVE_INFINITY;
  const byTs = new Map(rows.map((r) => [r.ts, r]));
  const declared = new Set(timestamps.map(intervalStart));
  const cap = spec.capacityKwp;

  const make = (kind: "net" | "energy"): CumulativeCurve => {
    const per = (r: { netCop: number; deliveredKwh: number }) => (kind === "net" ? r.netCop : r.deliveredKwh) / cap;
    const cumEnd = (r: CurveRow) => (kind === "net" ? r.cumNetPerKwp : r.cumKwh / cap);
    return {
      at(t: number) {
        const s = intervalStart(t);
        const frac = (t - s) / INTERVAL_MS;
        if (!last || s < firstTs) return 0;
        const row = byTs.get(s);
        if (row) return cumEnd(row) - per(row) + per(row) * frac;
        if (s > last.ts) {
          // Intervalo en curso (aún no guardado): se completa con el modelo.
          let cum = cumEnd(last);
          for (let x = last.ts + INTERVAL_MS; x < s; x += INTERVAL_MS) cum += per(intervalAt(spec, x, econ));
          return cum + per(intervalAt(spec, s, econ)) * frac;
        }
        if (!declared.has(s)) throw new Error(`Instante no declarado en buildCurves: ${new Date(t).toISOString()}`);
        return 0;
      },
    };
  };
  return { net: make("net"), energy: make("energy") };
}

/** Totales diarios de la planta (energía entregada, ingreso neto, energía solar). */
export async function plantDailyTotals(db: Db, spec: PlantSpec, fromDay: number, toDay: number) {
  return db
    .select({
      day: telemetry.day,
      deliveredKwh: sql<number>`sum(${telemetry.deliveredKwh})`,
      netCop: sql<number>`sum(${telemetry.netCop})`,
      solarKwh: sql<number>`sum(${telemetry.solarKw}) * 0.25`,
    })
    .from(telemetry)
    .where(and(eq(telemetry.plantId, spec.id), gte(telemetry.day, fromDay), lte(telemetry.day, toDay)))
    .groupBy(telemetry.day)
    .orderBy(asc(telemetry.day));
}

/** Intervalos guardados entre dos instantes. */
export async function intervalsBetween(db: Db, spec: PlantSpec, from: number, to: number) {
  return db
    .select()
    .from(telemetry)
    .where(and(eq(telemetry.plantId, spec.id), gte(telemetry.ts, from), lte(telemetry.ts, to)))
    .orderBy(asc(telemetry.ts));
}

/** Totales históricos de la planta hasta el último intervalo guardado. */
export async function plantLifetime(db: Db, spec: PlantSpec) {
  const [last] = await db
    .select({ cumKwh: telemetry.cumKwh, cumNetPerKwp: telemetry.cumNetPerKwp, ts: telemetry.ts })
    .from(telemetry)
    .where(eq(telemetry.plantId, spec.id))
    .orderBy(desc(telemetry.ts))
    .limit(1);
  return { cumKwh: last?.cumKwh ?? 0, cumNetPerKwp: last?.cumNetPerKwp ?? 0, lastTs: last?.ts ?? 0 };
}
