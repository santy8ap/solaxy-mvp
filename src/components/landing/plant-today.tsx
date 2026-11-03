"use client";
import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlantSpec } from "@/config/plant";
import { useSettings } from "@/lib/client/use-settings";
import { formatHourLabel, formatNumber, formatTime } from "@/lib/format";
import { useNow } from "@/lib/live/hooks";
import { HOUR_MS, dayStartMs, localDayIndex } from "@/lib/sim";
import { todayCurve } from "@/lib/telemetry/live";
import { ChartTooltipCard, LegendItem, SERIES } from "@/components/ui/chart-tooltip";

interface Point {
  ts: number;
  solar: number | null;
  battery: number | null;
  expected: number;
}

export function useTodaySeries(now: number | null): Point[] {
  const minuteKey = now ? Math.floor(now / 60_000) : 0;
  const { spec, econ } = useSettings();
  return useMemo(() => {
    if (!now) return [];
    return todayCurve(spec, now, econ).map((p) => ({
      ts: p.ts,
      solar: p.solarKw,
      // Solo cuando la batería entrega energía (evita una línea plana en cero).
      battery: p.batteryKw != null && p.batteryKw > 0.5 ? p.batteryKw : null,
      expected: p.expectedKw,
    }));
    // se recalcula una vez por minuto o si cambia la configuración
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuteKey, spec, econ]);
}

export function TodayChart({ now, height = 300 }: { now: number | null; height?: number }) {
  const data = useTodaySeries(now);
  const start = now ? dayStartMs(localDayIndex(now)) : 0;
  const ticks = [6, 9, 12, 15, 18, 21].map((h) => start + h * HOUR_MS);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
        <LegendItem label="Solar" color={SERIES.solar} />
        <LegendItem label="Batería" color={SERIES.battery} />
        <LegendItem label="Cielo despejado (esperado)" color={SERIES.reference} dashed />
        <span className="ml-auto text-sm text-silver-500">kW</span>
      </div>
      <div style={{ height }}>
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fill-solar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={SERIES.solar} stopOpacity={0.55} />
                  <stop offset="1" stopColor={SERIES.solar} stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="fill-battery" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={SERIES.battery} stopOpacity={0.6} />
                  <stop offset="1" stopColor={SERIES.battery} stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={SERIES.grid} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={[start, start + 24 * HOUR_MS]}
                ticks={ticks}
                tickFormatter={(t: number) => formatHourLabel(Math.round((t - start) / HOUR_MS))}
                stroke={SERIES.axis}
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                stroke={SERIES.axis}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={48}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                cursor={{ stroke: "#b7c1da", strokeOpacity: 0.4, strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Point;
                  return (
                    <ChartTooltipCard
                      title={formatTime(Number(label))}
                      rows={[
                        ...(p.solar != null ? [{ label: "Solar", value: `${formatNumber(p.solar)} kW`, color: SERIES.solar }] : []),
                        ...(p.battery ? [{ label: "Batería", value: `${formatNumber(p.battery)} kW`, color: SERIES.battery }] : []),
                        { label: "Esperado", value: `${formatNumber(p.expected)} kW`, color: SERIES.reference, dashed: true },
                      ]}
                    />
                  );
                }}
              />
              <Line dataKey="expected" stroke={SERIES.reference} strokeWidth={1.5} strokeDasharray="4 5" dot={false} isAnimationActive={false} />
              <Area dataKey="solar" stroke={SERIES.solar} strokeWidth={2} fill="url(#fill-solar)" isAnimationActive={false} connectNulls={false} />
              <Area dataKey="battery" stroke={SERIES.battery} strokeWidth={2} fill="url(#fill-battery)" isAnimationActive={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function specRows(spec: PlantSpec) {
  return [
    ["Capacidad instalada", `${formatNumber(spec.capacityKwp)} kWp`],
    ["Paneles", `${formatNumber(spec.moduleCount)} de ${spec.moduleWatt} W`],
    ["Inversores", `${spec.inverterCount} conectados a la red`],
    ["Batería", `${formatNumber(spec.battery.capacityKwh / 1000)} MWh, ${spec.battery.powerKw} kW`],
    ["Ubicación", spec.location],
  ] as const;
}

export function PlantToday() {
  const now = useNow(30_000);
  const { spec } = useSettings();
  const SPECS = specRows(spec);
  return (
    <section id="planta" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8" aria-labelledby="planta-title">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 id="planta-title" className="display text-[clamp(2rem,3.6vw,3rem)] text-silver-50">
            {spec.name}, hoy
          </h2>
          <p className="mt-4 max-w-[40ch] text-silver-300">
            La curva dorada es lo que la planta produjo hoy. La línea punteada es lo que produciría con el cielo
            despejado. En la noche entra la batería, que vende la energía guardada en la hora pico.
          </p>
          <dl className="mt-8 divide-y divide-silicon-600/50 border-y border-silicon-600/50">
            {SPECS.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                <dt className="text-silver-400">{k}</dt>
                <dd className="num text-right font-medium text-silver-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="panel p-5 sm:p-7">
          <TodayChart now={now} />
        </div>
      </div>
    </section>
  );
}
