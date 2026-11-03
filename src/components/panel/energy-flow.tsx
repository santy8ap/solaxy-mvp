"use client";
import { formatCop, formatNumber } from "@/lib/format";
import type { PlantReading } from "@/lib/sim";
import { useReducedMotion } from "@/lib/live/hooks";

interface Props {
  reading: PlantReading | null;
  myKw: number;
  ratePerHour: number;
}

type Tone = "sun" | "dusk" | "leaf" | "idle";
const TONE: Record<Tone, string> = { sun: "#f6b73c", dusk: "#a68bff", leaf: "#57d69b", idle: "#34488a" };

/** Línea con pulsos que avanzan más rápido cuanto más potencia pasa. */
function Flow({ d, kw, tone, reduced }: { d: string; kw: number; tone: Tone; reduced: boolean }) {
  const active = kw > 0.5 && tone !== "idle";
  const dur = active ? Math.max(0.6, 3.2 - Math.log10(1 + kw) * 0.9) : 0;
  return (
    <g>
      <path d={d} fill="none" stroke={TONE.idle} strokeOpacity="0.5" strokeWidth="2" />
      {active && (
        <path
          d={d}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 14"
          style={reduced ? undefined : { animation: `flow-dash ${dur}s linear infinite` }}
        />
      )}
    </g>
  );
}

function Node({ x, y, title, value, note, tone, icon }: { x: number; y: number; title: string; value: string; note?: string; tone: Tone; icon: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-82" y="-46" width="164" height="92" rx="16" fill="#0d1937" stroke={tone === "idle" ? "#22346a" : TONE[tone]} strokeOpacity={tone === "idle" ? 1 : 0.55} />
      <g transform="translate(-64 -28)" color={tone === "idle" ? "#6b789f" : TONE[tone]}>
        {icon}
      </g>
      <text x="-36" y="-14" fontSize="13" fill="#8e9ac0">
        {title}
      </text>
      <text x="-64" y="16" fontSize="20" fontWeight="650" fill="#f3f6fb" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </text>
      {note && (
        <text x="-64" y="35" fontSize="12" fill="#8e9ac0" style={{ fontVariantNumeric: "tabular-nums" }}>
          {note}
        </text>
      )}
    </g>
  );
}

const I = {
  sun: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10" cy="10" r="4.5" />
      <path d="M10 1v2.5M10 16.5V19M1 10h2.5M16.5 10H19M3.6 3.6l1.8 1.8M14.6 14.6l1.8 1.8M3.6 16.4l1.8-1.8M14.6 5.4l1.8-1.8" />
    </g>
  ),
  panel: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 3h14l-2 13H2z" />
      <path d="M9.5 3 8 16M3 9.5h14.4" />
    </g>
  ),
  battery: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="1" y="5" width="16" height="10" rx="2.5" />
      <path d="M19 8.5v3" />
      <rect x="3.5" y="7.5" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
    </g>
  ),
  grid: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 1 5 19M10 1l5 18M6.5 7h7M5.6 12h8.8M10 1v18" />
    </g>
  ),
  wallet: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="1" y="4" width="18" height="13" rx="3" />
      <path d="M14 10.5h2" />
      <path d="M4 4l9-3 1.5 3" />
    </g>
  ),
};

/**
 * Del sol a tu billetera: el recorrido de la energía con valores en vivo.
 * De noche la línea solar se apaga y la batería alimenta la red.
 */
export function EnergyFlow({ reading, myKw, ratePerHour }: Props) {
  const reduced = useReducedMotion();
  const solar = reading?.solarKw ?? 0;
  const bat = reading?.batteryKw ?? 0;
  const delivered = reading?.deliveredKw ?? 0;
  const night = solar < 1;
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 50 1100 270" className="min-w-[760px]" role="img" aria-label={`Flujo de energía: ${formatNumber(solar)} kW solares, batería ${formatNumber(bat)} kW, ${formatNumber(delivered)} kW entregados`}>
        <style>{`@keyframes flow-dash { to { stroke-dashoffset: -32; } }`}</style>
        <Flow d="M182 110 H 318" kw={solar} tone="sun" reduced={reduced} />
        <Flow d="M482 110 H 618" kw={Math.max(0, solar + Math.min(0, bat))} tone="sun" reduced={reduced} />
        <Flow d="M400 156 V 214" kw={Math.max(0, -bat)} tone="sun" reduced={reduced} />
        <Flow d="M482 260 C 560 260, 560 150, 618 132" kw={Math.max(0, bat)} tone="dusk" reduced={reduced} />
        <Flow d="M782 110 H 918" kw={myKw > 0 ? delivered : 0} tone="leaf" reduced={reduced} />

        <Node x={100} y={110} title="Sol" value={`${formatNumber(reading?.irradiance ?? 0)} W/m²`} note={night ? "bajo el horizonte" : "irradiancia"} tone={night ? "idle" : "sun"} icon={I.sun} />
        <Node x={400} y={110} title="Paneles" value={`${formatNumber(solar)} kW`} note={`${formatNumber(reading?.moduleTempC ?? 0, 1)} °C en módulos`} tone={night ? "idle" : "sun"} icon={I.panel} />
        <Node
          x={400}
          y={260}
          title="Batería"
          value={`${formatNumber(reading?.socPct ?? 0)} %`}
          note={bat > 1 ? `entrega ${formatNumber(bat)} kW` : bat < -1 ? `carga ${formatNumber(-bat)} kW` : "en espera"}
          tone={bat > 1 ? "dusk" : bat < -1 ? "sun" : "idle"}
          icon={I.battery}
        />
        <Node x={700} y={110} title="Red y clientes" value={`${formatNumber(delivered)} kW`} note={`tarifa ${formatCop(reading?.tariffCopPerKwh ?? 0)}/kWh`} tone={delivered > 1 ? (night ? "dusk" : "sun") : "idle"} icon={I.grid} />
        <Node x={1000} y={110} title="Tu parte" value={`${formatNumber(myKw, 2)} kW`} note={`${formatCop(ratePerHour)} por hora`} tone={myKw > 0 ? "leaf" : "idle"} icon={I.wallet} />
      </svg>
    </div>
  );
}
