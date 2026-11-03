import type { PlantSpec } from "@/config/plant";
import { solarCosZenith } from "./solar";
import { HOUR_MS, dayStartMs, localDayIndex } from "./time";

/** cos(90,833°): el sol "toca" el horizonte considerando la refracción. */
const HORIZON = Math.cos((90.833 * Math.PI) / 180);

function crossing(spec: PlantSpec, from: number, to: number, rising: boolean) {
  let lo = from;
  let hi = to;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const above = solarCosZenith(mid, spec.lat, spec.lng) > HORIZON;
    if (above === rising) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export interface SunDay {
  sunrise: number;
  sunset: number;
  noon: number;
  /** Elevación máxima del día, en grados */
  maxElevation: number;
}

const cache = new Map<string, SunDay>();

/** Amanecer, atardecer y elevación máxima del sol en el día local de `ts`. */
export function sunDay(spec: PlantSpec, ts: number): SunDay {
  const day = localDayIndex(ts);
  const key = `${spec.lat}:${spec.lng}:${day}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const start = dayStartMs(day);
  const sunrise = crossing(spec, start + 3 * HOUR_MS, start + 9 * HOUR_MS, true);
  const sunset = crossing(spec, start + 15 * HOUR_MS, start + 21 * HOUR_MS, false);
  const noon = (sunrise + sunset) / 2;
  const maxElevation = (Math.asin(Math.min(1, solarCosZenith(noon, spec.lat, spec.lng))) * 180) / Math.PI;
  const res = { sunrise, sunset, noon, maxElevation };
  cache.set(key, res);
  return res;
}

/** Elevación del sol en grados (negativa de noche). */
export function sunElevation(spec: PlantSpec, ts: number) {
  return (Math.asin(Math.max(-1, Math.min(1, solarCosZenith(ts, spec.lat, spec.lng)))) * 180) / Math.PI;
}
