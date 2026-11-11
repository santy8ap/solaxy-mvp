import type { SolarDay } from "@/config/solar";
import { DAY_MS, HOUR_MS, dayStartMs, localDayIndex, localHour } from "@/lib/time";

/**
 * La campana de generación: potencia = máximo × sen(π·x), con x la fracción del día solar.
 * Puro e isomórfico: el servidor calcula el saldo con esto y el navegador mueve los contadores.
 */

export function solarHours(s: SolarDay) {
  return s.endHour - s.startHour;
}

/** Fracción del día solar en el instante `ts`: 0 antes de que empiece, 1 cuando ya terminó. */
export function dayFraction(s: SolarDay, ts: number) {
  const x = (localHour(ts) - s.startHour) / solarHours(s);
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

/** Altura de la campana (0 a 1) en la fracción `x` del día solar. */
export function shape(x: number) {
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x);
}

/** Parte de la energía del día (0 a 1) que ya se generó en la fracción `x`. */
export function cumulative(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return (1 - Math.cos(Math.PI * x)) / 2;
}

/**
 * Días solares transcurridos, con fracción: avanza exactamente 1 por cada día y solo crece
 * mientras hay generación. La energía entre dos instantes es proporcional a su diferencia.
 */
export function solarProgress(s: SolarDay, ts: number) {
  return localDayIndex(ts) + cumulative(dayFraction(s, ts));
}

export function isGenerating(s: SolarDay, ts: number) {
  const x = dayFraction(s, ts);
  return x > 0 && x < 1;
}

/** Potencia de la planta según la curva (kW). */
export function plantPowerKw(s: SolarDay, ts: number) {
  return s.peakKw * shape(dayFraction(s, ts));
}

/** Energía que entrega la planta en un día: el área bajo la campana (kWh). */
export function plantDailyKwh(s: SolarDay) {
  return (s.peakKw * solarHours(s) * 2) / Math.PI;
}

/** Cuándo empieza la generación del día siguiente (o la de hoy, si todavía no empieza). */
export function nextSunriseMs(s: SolarDay, ts: number) {
  const today = dayStartMs(localDayIndex(ts)) + s.startHour * HOUR_MS;
  return ts < today ? today : today + DAY_MS;
}

/** Cuándo termina la generación del día de `ts`. */
export function sunsetMs(s: SolarDay, ts: number) {
  return dayStartMs(localDayIndex(ts)) + s.endHour * HOUR_MS;
}
