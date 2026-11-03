"use client";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSettings } from "@/lib/client/use-settings";
import type { PortfolioDTO } from "@/lib/portfolio";
import { useJson } from "@/lib/client/use-json";
import { formatClock, formatCop, formatNumber, formatTime } from "@/lib/format";
import { useLive, useNow } from "@/lib/live/hooks";
import { ChartTooltipCard, SERIES } from "@/components/ui/chart-tooltip";
import { Odometer } from "@/components/ui/odometer";
import { TodayChart } from "@/components/landing/plant-today";
import { plantStatus } from "@/components/landing/hero";
import { Topbar } from "./shell";

type Scope = "planta" | "mia";

/** Últimos ~10 minutos de lecturas (una cada 2 s) guardados en el navegador. */
function useRecent(ts: number | undefined, kw: number | undefined, solar: number | undefined) {
  const [points, setPoints] = useState<{ ts: number; kw: number; solar: number }[]>([]);
  const last = useRef(0);
  useEffect(() => {
    if (ts == null || kw == null || solar == null) return;
    if (Math.abs(ts - last.current) < 1500) return;
    last.current = ts;
    setPoints((p) => {
      const next = [...p.filter((x) => x.ts < ts && ts - x.ts < 10 * 60_000), { ts, kw, solar }];
      return next.slice(-300);
    });
  }, [ts, kw, solar]);
  return points;
}

function Metric({ label, value, unit, note, tone }: { label: string; value: string; unit?: string; note?: string; tone?: string }) {
  return (
    <div className="bg-silicon-850 p-4 sm:p-5">
      <div className="text-sm text-silver-400">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold ${tone ?? "text-silver-50"}`}>
        {value}
        {unit && <span className="ml-1 text-base font-normal text-silver-400">{unit}</span>}
      </div>
      {note && <div className="mt-0.5 text-sm text-silver-500">{note}</div>}
    </div>
  );
}

export function Telemetry() {
  const live = useLive();
  const now = useNow(1000);
  const { spec } = useSettings();
  const { data: p } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 60_000 });
  const [scope, setScope] = useState<Scope>("planta");
  const r = live.payload?.reading;
  const today = live.payload?.today;
  const share = scope === "mia" && p ? p.kw / spec.capacityKwp : 1;
  const recent = useRecent(r?.ts, r ? r.deliveredKw * share : undefined, r ? r.solarKw * share : undefined);
  const status = r && now ? plantStatus(r, now) : null;
  const k = (v: number | undefined) => (v ?? 0) * share;
  const decimals = scope === "mia" ? 2 : 0;

  return (
    <>
      <Topbar title="Telemetría" subtitle={`${spec.name}, ${spec.location}`} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-silicon-600/70 bg-silicon-950/50 p-1" role="tablist" aria-label="Ver datos de">
          {(
            [
              ["planta", "Toda la planta"],
              ["mia", p ? `Tu parte (${formatNumber(p.kw, 1)} kW)` : "Tu parte"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={scope === id}
              onClick={() => setScope(id)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${scope === id ? "bg-silicon-600 font-semibold text-silver-50" : "text-silver-300 hover:text-silver-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost !py-2.5 text-sm" onClick={() => window.dispatchEvent(new Event("solaxy:presenter"))}>
          Simular otra hora
        </button>
      </div>

      <section className="panel cells grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.6fr]" aria-label="Potencia en vivo">
        <div>
          <div className="flex items-center gap-2 text-sm text-silver-400">
            <span className="live-dot" data-tone={live.status === "simulated" ? "sim" : live.status === "live" ? undefined : "off"} />
            {live.status === "simulated" ? "Simulación" : "En vivo"}, {r ? formatClock(r.ts) : ""}
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <Odometer value={k(r?.deliveredKw)} decimals={decimals} className={`display text-[3.6rem] ${status?.tone === "dusk" ? "text-dusk-300" : status?.tone === "off" ? "text-silver-300" : "text-sun-300"}`} />
            <span className="text-2xl text-silver-300">kW</span>
          </div>
          <p className="mt-2 text-silver-100">Potencia entregada a la red, {status?.label ?? "…"}</p>
          <p className="mt-1 text-sm text-silver-400">{status?.detail}</p>
        </div>
        <div className="h-[180px]">
          {recent.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recent} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fill-recent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={status?.tone === "dusk" ? SERIES.battery : SERIES.solar} stopOpacity={0.5} />
                    <stop offset="1" stopColor={status?.tone === "dusk" ? SERIES.battery : SERIES.solar} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="ts" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => formatTime(t)} stroke={SERIES.axis} tickLine={false} axisLine={false} fontSize={12} minTickGap={60} />
                <YAxis
                  domain={[(min: number) => Math.max(0, min - Math.max(Math.abs(min) * 0.04, 0.5)), (max: number) => max + Math.max(Math.abs(max) * 0.04, 0.5)]}
                  tickCount={4}
                  tickFormatter={(v: number) => formatNumber(v, scope === "mia" ? 2 : 0)}
                  stroke={SERIES.axis}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={54}
                />
                <Tooltip
                  cursor={{ stroke: "#b7c1da", strokeOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof recent)[number];
                    return <ChartTooltipCard title={formatClock(d.ts)} rows={[{ label: "Entregada", value: `${formatNumber(d.kw, decimals)} kW`, color: status?.tone === "dusk" ? SERIES.battery : SERIES.solar }]} />;
                  }}
                />
                <Area type="monotone" dataKey="kw" stroke={status?.tone === "dusk" ? SERIES.battery : SERIES.solar} strokeWidth={2} fill="url(#fill-recent)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <p className="mt-1 text-right text-xs text-silver-500">Últimos 10 minutos, una lectura cada 2 segundos</p>
        </div>
      </section>

      <section className="mt-5 grid overflow-hidden rounded-[var(--radius-panel)] border border-silicon-600/50 bg-silicon-600/50 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }} aria-label="Mediciones">
        <Metric label="Producción solar" value={formatNumber(k(r?.solarKw), decimals)} unit="kW" note={`de ${formatNumber(spec.acCapacityKw * share, decimals)} kW de capacidad AC`} tone="text-sun-300" />
        <Metric label="Irradiancia" value={formatNumber(r?.irradiance ?? 0)} unit="W/m²" note="sobre el plano de los paneles" />
        <Metric label="Temperatura de módulos" value={formatNumber(r?.moduleTempC ?? 0, 1)} unit="°C" note={`ambiente ${formatNumber(r?.ambientTempC ?? 0, 1)} °C`} />
        <Metric
          label="Batería"
          value={formatNumber(r?.socPct ?? 0)}
          unit="%"
          note={r && r.batteryKw > 1 ? `entregando ${formatNumber(k(r.batteryKw), decimals)} kW` : r && r.batteryKw < -1 ? `cargando ${formatNumber(k(-r.batteryKw), decimals)} kW` : "en espera"}
          tone="text-dusk-300"
        />
        <Metric label="Tensión DC de strings" value={formatNumber(r?.dcVoltageV ?? 0)} unit="V" note={r && r.dcVoltageV > 0 ? "paneles generando" : "sin luz solar"} />
        <Metric label="Tensión AC" value={formatNumber(r?.acVoltageV ?? 0, 1)} unit="V" note="punto de conexión" />
        <Metric label="Corriente AC" value={formatNumber(k(r?.acCurrentA), scope === "mia" ? 1 : 0)} unit="A" note="trifásica" />
        <Metric label="Frecuencia de red" value={formatNumber(r?.frequencyHz ?? 60, 2)} unit="Hz" note="sistema colombiano: 60 Hz" />
        <Metric label="Energía entregada hoy" value={formatNumber(k(today?.deliveredKwh), decimals)} unit="kWh" tone="text-silver-50" />
        <Metric label="Producción solar hoy" value={formatNumber(k(today?.solarKwh), decimals)} unit="kWh" />
        <Metric label="Pico solar de hoy" value={formatNumber(k(today?.peakKw), decimals)} unit="kW" />
        <Metric label={scope === "mia" ? "Tus ganancias de hoy" : "Ingreso neto de hoy"} value={formatCop(k(today?.netCop))} tone="text-leaf-300" note={`tarifa actual ${formatCop(r?.tariffCopPerKwh ?? 0)}/kWh`} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5 sm:p-7" aria-labelledby="curve-title">
          <h2 id="curve-title" className="mb-4 text-lg font-semibold text-silver-50">
            Curva de hoy
          </h2>
          <TodayChart now={now} height={280} />
        </section>
        <section className="panel p-5 sm:p-7" aria-labelledby="inv-title">
          <h2 id="inv-title" className="text-lg font-semibold text-silver-50">
            Inversores
          </h2>
          <p className="mb-4 mt-1 text-sm text-silver-400">{spec.inverterCount} equipos de {formatNumber(spec.acCapacityKw / spec.inverterCount)} kW</p>
          <ul className="space-y-2.5">
            {(r?.inverters ?? []).map((inv) => {
              const max = spec.acCapacityKw / spec.inverterCount;
              return (
                <li key={inv.id} className="grid grid-cols-[64px_1fr_76px] items-center gap-3 text-sm">
                  <span className="num text-silver-300">{inv.id}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-silicon-700">
                    <span className="block h-full rounded-full bg-sun-500 transition-[width] duration-700" style={{ width: `${Math.min(100, (inv.kw / max) * 100)}%` }} />
                  </span>
                  <span className="num text-right text-silver-100">{inv.status === "generando" ? `${formatNumber(k(inv.kw), decimals)} kW` : "en espera"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
