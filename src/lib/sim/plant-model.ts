import { ECONOMICS } from "@/config/economics";
import type { PlantSpec } from "@/config/plant";
import { hash01 } from "./hash";
import { solarPoint } from "./solar";
import {
  INTERVAL_HOURS,
  INTERVAL_MS,
  INTERVALS_PER_DAY,
  dayStartMs,
  inWindow,
  localDayIndex,
  localHour,
} from "./time";

type Economics = typeof ECONOMICS;

/** Un intervalo de 15 minutos de la planta (lo que se guarda en la base de datos). */
export interface PlantInterval {
  ts: number;
  day: number;
  solarKw: number;
  chargeKw: number;
  dischargeKw: number;
  /** Positivo = la batería entrega; negativo = carga */
  batteryKw: number;
  /** Estado de carga al final del intervalo, % */
  socPct: number;
  deliveredKw: number;
  deliveredKwh: number;
  irradiance: number;
  ambientTempC: number;
  moduleTempC: number;
  tariffCopPerKwh: number;
  revenueCop: number;
  netCop: number;
}

export interface InverterReading {
  id: string;
  kw: number;
  status: "generando" | "en espera";
}

/** Lectura instantánea (cada 2 s) de la telemetría. */
export interface PlantReading {
  ts: number;
  solarKw: number;
  batteryKw: number;
  socPct: number;
  deliveredKw: number;
  irradiance: number;
  ambientTempC: number;
  moduleTempC: number;
  dcVoltageV: number;
  acVoltageV: number;
  acCurrentA: number;
  frequencyHz: number;
  tariffCopPerKwh: number;
  inverters: InverterReading[];
}

const SAMPLES = [0.1, 0.3, 0.5, 0.7, 0.9];
const profileCache = new Map<string, PlantInterval[]>();

export function tariffAt(ts: number, econ: Economics = ECONOMICS) {
  return inWindow(localHour(ts), econ.peakWindow) ? econ.tariffPeakCopPerKwh : econ.tariffDayCopPerKwh;
}

function computeDayProfile(spec: PlantSpec, day: number, econ: Economics): PlantInterval[] {
  const bat = spec.battery;
  const start = dayStartMs(day);
  const minKwh = bat.minSoc * bat.capacityKwh;
  const maxKwh = bat.maxSoc * bat.capacityKwh;
  // Cada día empieza con la batería en su mínimo: la descarga nocturna la vacía hasta ahí.
  let socKwh = minKwh;
  const out: PlantInterval[] = [];

  for (let k = 0; k < INTERVALS_PER_DAY; k++) {
    const ts = start + k * INTERVAL_MS;
    let solarKw = 0;
    let irradiance = 0;
    for (const f of SAMPLES) {
      const p = solarPoint(spec, ts + f * INTERVAL_MS);
      solarKw += p.acKw;
      irradiance += p.irradiance;
    }
    solarKw /= SAMPLES.length;
    irradiance /= SAMPLES.length;
    const mid = solarPoint(spec, ts + INTERVAL_MS / 2);

    const h = localHour(ts);
    let chargeKw = 0;
    let dischargeKw = 0;
    if (inWindow(h, bat.chargeWindow) && socKwh < maxKwh && solarKw > 0) {
      const roomKw = (maxKwh - socKwh) / bat.chargeEff / INTERVAL_HOURS;
      chargeKw = Math.min(bat.powerKw, solarKw * bat.chargeFraction, roomKw);
      socKwh = Math.min(maxKwh, socKwh + chargeKw * INTERVAL_HOURS * bat.chargeEff);
    }
    if (inWindow(h, bat.dischargeWindow) && socKwh > minKwh) {
      const remainingIntervals = Math.max(1, Math.round((bat.dischargeWindow[1] - h) / INTERVAL_HOURS));
      const deliverableKwh = (socKwh - minKwh) * bat.dischargeEff;
      dischargeKw = Math.min(bat.powerKw, deliverableKwh / (remainingIntervals * INTERVAL_HOURS));
      socKwh = Math.max(minKwh, socKwh - (dischargeKw * INTERVAL_HOURS) / bat.dischargeEff);
    }

    const deliveredKw = solarKw - chargeKw + dischargeKw;
    const deliveredKwh = deliveredKw * INTERVAL_HOURS;
    const tariff = tariffAt(ts, econ);
    const revenueCop = deliveredKwh * tariff;
    out.push({
      ts,
      day,
      solarKw,
      chargeKw,
      dischargeKw,
      batteryKw: dischargeKw - chargeKw,
      socPct: (socKwh / bat.capacityKwh) * 100,
      deliveredKw,
      deliveredKwh,
      irradiance,
      ambientTempC: mid.ambientTempC,
      moduleTempC: mid.moduleTempC,
      tariffCopPerKwh: tariff,
      revenueCop,
      netCop: revenueCop * econ.netFactor,
    });
  }
  return out;
}

/** Los 96 intervalos de 15 minutos de un día local (memorizado). */
export function dayProfile(spec: PlantSpec, day: number, econ: Economics = ECONOMICS): PlantInterval[] {
  const key = `${spec.id}:${spec.seed}:${day}:${econ.netFactor}:${econ.tariffDayCopPerKwh}:${econ.tariffPeakCopPerKwh}`;
  let profile = profileCache.get(key);
  if (!profile) {
    profile = computeDayProfile(spec, day, econ);
    profileCache.set(key, profile);
    if (profileCache.size > 400) {
      const oldest = profileCache.keys().next().value;
      if (oldest !== undefined) profileCache.delete(oldest);
    }
  }
  return profile;
}

/** El intervalo que contiene a `ts`. */
export function intervalAt(spec: PlantSpec, ts: number, econ: Economics = ECONOMICS): PlantInterval {
  const day = localDayIndex(ts);
  const k = Math.min(INTERVALS_PER_DAY - 1, Math.floor((ts - dayStartMs(day)) / INTERVAL_MS));
  return dayProfile(spec, day, econ)[k];
}

/** Lectura instantánea con un pequeño ruido de medición cada 2 segundos. */
export function instantReading(spec: PlantSpec, ts: number, econ: Economics = ECONOMICS): PlantReading {
  const day = localDayIndex(ts);
  const profile = dayProfile(spec, day, econ);
  const k = Math.min(INTERVALS_PER_DAY - 1, Math.floor((ts - dayStartMs(day)) / INTERVAL_MS));
  const interval = profile[k];
  const prevSoc = k > 0 ? profile[k - 1].socPct : spec.battery.minSoc * 100;
  const frac = (ts - interval.ts) / INTERVAL_MS;

  const bucket = Math.floor(ts / 2000);
  const noise = (salt: number) => hash01(spec.seed, bucket, salt) - 0.5;
  const exact = solarPoint(spec, ts);
  const solarKw = Math.min(spec.acCapacityKw, Math.max(0, exact.acKw * (1 + noise(3) * 0.024)));
  const irradiance = exact.irradiance * (1 + noise(4) * 0.02);

  const chargeKw = Math.min(interval.chargeKw, solarKw);
  const dischargeKw = interval.dischargeKw > 0 ? interval.dischargeKw * (1 + noise(5) * 0.006) : 0;
  const batteryKw = dischargeKw - chargeKw;
  const deliveredKw = Math.max(0, solarKw + batteryKw);

  const acVoltageV = 480 * (1 + noise(6) * 0.004);
  const dcVoltageV =
    exact.irradiance > 5
      ? 1150 * (1 - 0.0029 * (exact.moduleTempC - 25)) * (0.96 + 0.04 * Math.min(1, exact.irradiance / 400))
      : 0;

  const weights = Array.from({ length: spec.inverterCount }, (_, i) => 1 + (hash01(spec.seed, i, 9) - 0.5) * 0.06);
  const wSum = weights.reduce((s, w) => s + w, 0);
  const inverters: InverterReading[] = weights.map((w, i) => ({
    id: `INV-${String(i + 1).padStart(2, "0")}`,
    kw: (solarKw * w) / wSum,
    status: solarKw > 0.5 ? "generando" : "en espera",
  }));

  return {
    ts,
    solarKw,
    batteryKw,
    socPct: prevSoc + (interval.socPct - prevSoc) * frac,
    deliveredKw,
    irradiance,
    ambientTempC: exact.ambientTempC,
    moduleTempC: exact.moduleTempC,
    dcVoltageV,
    acVoltageV,
    acCurrentA: (deliveredKw * 1000) / (Math.sqrt(3) * acVoltageV * 0.99),
    frequencyHz: 60 + noise(7) * 0.04,
    tariffCopPerKwh: interval.tariffCopPerKwh,
    inverters,
  };
}

/** Curva esperada con cielo despejado (para comparar contra lo real). */
export function clearSkyKwAt(spec: PlantSpec, ts: number) {
  return solarPoint(spec, ts, false).acKw;
}
