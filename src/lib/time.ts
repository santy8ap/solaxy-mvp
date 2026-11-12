/** Utilidades de tiempo para America/Bogota (UTC−5, sin horario de verano). */
export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const TZ_OFFSET_MS = -5 * HOUR_MS;

/** Instante (ms UTC) de una hora local de Bogotá. `month` va de 1 a 12. */
export function bogotaMs(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return Date.UTC(year, month - 1, day, hour, minute, second) - TZ_OFFSET_MS;
}

/** Número de día local (días desde 1970-01-01 en hora de Bogotá). */
export function localDayIndex(ts: number) {
  return Math.floor((ts + TZ_OFFSET_MS) / DAY_MS);
}

/** Instante en que empieza (00:00 local) el día indicado. */
export function dayStartMs(dayIndex: number) {
  return dayIndex * DAY_MS - TZ_OFFSET_MS;
}

/** Hora local en formato decimal (0 ≤ h < 24). */
export function localHour(ts: number) {
  const local = ts + TZ_OFFSET_MS;
  return (((local % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS;
}
