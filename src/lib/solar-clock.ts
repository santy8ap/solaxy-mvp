import { localHour } from "@/lib/sim/time";

export const SOLAR_CLOCK = { start: 6, end: 19, maxKw: 8_000 } as const;

/** Visual projection only. Never used to credit energy or monetary balances. */
export function projectedSolarKw(hour: number): number {
  if (
    !Number.isFinite(hour) ||
    hour <= SOLAR_CLOCK.start ||
    hour >= SOLAR_CLOCK.end
  )
    return 0;
  const phase =
    (hour - SOLAR_CLOCK.start) / (SOLAR_CLOCK.end - SOLAR_CLOCK.start);
  return SOLAR_CLOCK.maxKw * Math.sin(Math.PI * phase) ** 2;
}

export function solarClockAt(ts: number) {
  const hour = localHour(ts);
  return { hour, active: hour >= 6 && hour < 19, kw: projectedSolarKw(hour) };
}
