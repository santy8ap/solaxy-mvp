import { DAY_MS, dayStartMs } from "@/lib/sim/time";

/** Un movimiento de kW: positivo al comprar, negativo al vender. */
export interface KwEntry {
  kwDelta: number;
  ts: number;
}

/** Ingreso neto acumulado por kWp de la planta hasta el instante `ts` (COP). */
export interface CumulativeCurve {
  at(ts: number): number;
}

export function kwOwnedAt(entries: readonly KwEntry[], ts: number): number {
  let kw = 0;
  for (const e of entries) if (e.ts <= ts) kw += e.kwDelta;
  return Math.max(0, round9(kw));
}

/**
 * Ganancia acumulada hasta `ts`: Σ kwDelta × (C(ts) − C(ts_movimiento)).
 * Una venta (kwDelta negativo) cancela las ganancias de esos kW desde que se vende.
 */
export function earningsAt(entries: readonly KwEntry[], curve: CumulativeCurve, ts: number): number {
  const cNow = curve.at(ts);
  let total = 0;
  for (const e of entries) {
    if (e.ts > ts) continue;
    total += e.kwDelta * (cNow - curve.at(e.ts));
  }
  return total;
}

export interface DailyEarning {
  day: number;
  earnedCop: number;
  /** kW que tenía al final del día (o ahora, si es hoy) */
  kw: number;
}

/** Ganancias de cada día local indicado (el día en curso se corta en `now`). */
export function dailyEarnings(
  entries: readonly KwEntry[],
  curve: CumulativeCurve,
  days: readonly number[],
  now: number,
): DailyEarning[] {
  return days.map((day) => {
    const start = dayStartMs(day);
    const end = Math.min(start + DAY_MS, now);
    if (end <= start) return { day, earnedCop: 0, kw: kwOwnedAt(entries, start) };
    const cEnd = curve.at(end);
    let earned = 0;
    for (const e of entries) {
      if (e.ts >= end) continue;
      const from = Math.max(start, e.ts);
      earned += e.kwDelta * (cEnd - curve.at(from));
    }
    return { day, earnedCop: earned, kw: kwOwnedAt(entries, end) };
  });
}

function round9(n: number) {
  return Math.round(n * 1e9) / 1e9;
}
