import type { PlantSpec } from "@/config/plant";
import { hash01, valueNoise } from "./hash";
import { DAY_MS, HOUR_MS, localDayIndex, localHour } from "./time";

const DEG = Math.PI / 180;

/** Coseno del ángulo cenital del sol (ecuaciones simplificadas de NOAA). */
export function solarCosZenith(ts: number, latDeg: number, lngDeg: number): number {
  const date = new Date(ts);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((ts - yearStart) / DAY_MS) + 1;
  const utcHours = (((ts % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const trueSolarMin = utcHours * 60 + eqTimeMin + 4 * lngDeg;
  const hourAngle = (trueSolarMin / 4 - 180) * DEG;
  const lat = latDeg * DEG;
  return Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
}

/** Irradiancia global con cielo despejado (modelo de Haurwitz), W/m². */
export function clearSkyGhi(cosZ: number): number {
  if (cosZ <= 0.01) return 0;
  return 1098 * cosZ * Math.exp(-0.057 / cosZ);
}

/** Claridad del día (0..1): unos días son soleados y otros nublados. */
export function dayClearness(spec: PlantSpec, ts: number): number {
  return 0.45 + 0.45 * hash01(spec.seed, localDayIndex(ts), 1);
}

/**
 * Fracción de luz que atraviesa las nubes (0..1). En Antioquia las tardes
 * suelen nublarse, así que la profundidad de nubes crece después del mediodía.
 */
export function cloudTransmittance(spec: PlantSpec, ts: number): number {
  const day = localDayIndex(ts);
  const h = localHour(ts);
  const cloudiness = 1 - dayClearness(spec, ts);
  const afternoon = h <= 12 ? 0 : Math.min(1, (h - 12) / 3) * 0.3 * hash01(spec.seed, day, 2);
  const depth = Math.min(0.9, cloudiness + afternoon);
  const slow = valueNoise(spec.seed ^ (day * 7919), ts / (18 * 60_000));
  const fast = valueNoise((spec.seed + 101) ^ (day * 104729), ts / (5 * 60_000));
  const p = 0.7 * slow + 0.3 * fast;
  return 1 - depth * (0.3 + 0.7 * p * p);
}

/** Temperatura ambiente: mínima ~5:30, máxima ~14:30; los días nublados son más frescos. */
export function ambientTempC(spec: PlantSpec, ts: number): number {
  const h = localHour(ts);
  let shape: number;
  if (h >= 5.5 && h <= 14.5) {
    shape = (1 - Math.cos((Math.PI * (h - 5.5)) / 9)) / 2;
  } else {
    const since = (h - 14.5 + 24) % 24;
    shape = (1 + Math.cos((Math.PI * since) / 15)) / 2;
  }
  const { tMinC, tMaxC } = spec.climate;
  const sunny = 0.7 + 0.3 * dayClearness(spec, ts);
  return tMinC + (tMaxC - tMinC) * shape * sunny;
}

export interface SolarPoint {
  irradiance: number;
  ambientTempC: number;
  moduleTempC: number;
  acKw: number;
}

/** Punto exacto (sin ruido de medición) del modelo solar. */
export function solarPoint(spec: PlantSpec, ts: number, withClouds = true): SolarPoint {
  const cosZ = solarCosZenith(ts, spec.lat, spec.lng);
  const ghi = clearSkyGhi(cosZ) * (withClouds ? cloudTransmittance(spec, ts) : 1);
  const ambient = ambientTempC(spec, ts);
  const moduleTemp = ambient + (ghi / 800) * 26;
  const dcKw =
    spec.capacityKwp * (ghi / 1000) * spec.performanceRatio * (1 + spec.tempCoeffPerC * (moduleTemp - 25));
  const acKw = Math.min(Math.max(dcKw, 0), spec.acCapacityKw);
  return { irradiance: ghi, ambientTempC: ambient, moduleTempC: moduleTemp, acKw };
}
