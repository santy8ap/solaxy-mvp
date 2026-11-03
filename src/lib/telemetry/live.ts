import type { PlantSpec } from "@/config/plant";
import {
  INTERVAL_MS,
  clearSkyKwAt,
  dayProfile,
  instantReading,
  localDayIndex,
  type PlantReading,
} from "@/lib/sim";

export interface LiveToday {
  deliveredKwh: number;
  solarKwh: number;
  netCop: number;
  peakKw: number;
}

export interface LivePayload {
  reading: PlantReading;
  today: LiveToday;
}

/** Lectura en vivo + acumulados del día (mismo modelo en servidor y navegador). */
export function livePayload(spec: PlantSpec, now: number): LivePayload {
  const day = localDayIndex(now);
  const profile = dayProfile(spec, day);
  const today: LiveToday = { deliveredKwh: 0, solarKwh: 0, netCop: 0, peakKw: 0 };
  for (const i of profile) {
    if (i.ts >= now) break;
    const frac = Math.min(1, (now - i.ts) / INTERVAL_MS);
    today.deliveredKwh += i.deliveredKwh * frac;
    today.solarKwh += i.solarKw * 0.25 * frac;
    today.netCop += i.netCop * frac;
    today.peakKw = Math.max(today.peakKw, i.solarKw);
  }
  return { reading: instantReading(spec, now), today };
}

export interface TodayPoint {
  ts: number;
  solarKw: number | null;
  deliveredKw: number | null;
  batteryKw: number | null;
  socPct: number | null;
  expectedKw: number;
}

/** Curva del día: real hasta ahora + esperada con cielo despejado para todo el día. */
export function todayCurve(spec: PlantSpec, now: number): TodayPoint[] {
  const day = localDayIndex(now);
  return dayProfile(spec, day).map((i) => {
    const done = i.ts + INTERVAL_MS <= now;
    const current = i.ts <= now && !done;
    const show = done || current;
    return {
      ts: i.ts,
      solarKw: show ? i.solarKw : null,
      deliveredKw: show ? i.deliveredKw : null,
      batteryKw: show ? i.batteryKw : null,
      socPct: show ? i.socPct : null,
      expectedKw: clearSkyKwAt(spec, i.ts + INTERVAL_MS / 2),
    };
  });
}
