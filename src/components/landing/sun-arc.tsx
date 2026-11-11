"use client";
import { useId } from "react";
import type { PlantReading } from "@/lib/sim";
import { projectedSolarKw, solarClockAt, SOLAR_CLOCK } from "@/lib/solar-clock";

interface Props {
  now: number | null;
  reading: PlantReading | null;
  compact?: boolean;
  acCapacityKw?: number;
}
const x = (h: number) => 68 + ((h - 6) / 13) * 1040;
const y = (h: number) => 310 - (projectedSolarKw(h) / SOLAR_CLOCK.maxKw) * 248;
const curve = Array.from({ length: 157 }, (_, i) => {
  const h = 6 + i / 12;
  return `${i ? "L" : "M"}${x(h).toFixed(2)},${y(h).toFixed(2)}`;
}).join(" ");

/** Fixed 06–19h projected cycle in Bogotá. Deliberately separate from metering. */
export function SunArc({ now, compact = false }: Props) {
  const id = useId().replace(/:/g, "");
  const current = now !== null ? solarClockAt(now) : null;
  const h = Math.min(19, Math.max(6, current?.hour ?? 6));
  return (
    <div className={`solar-clock ${compact ? "solar-clock-compact" : ""}`}>
      <div className="solar-clock-caption">
        <span>Curva solar proyectada</span>
        <span>Máximo 8.000 kW</span>
      </div>
      <svg
        viewBox="0 0 1180 380"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>Reloj solar de 6 a. m. a 7 p. m.</title>
        <desc id={`${id}-desc`}>
          Proyección en forma de campana con máximo de 8.000 kW a las 12:30,
          hora de Bogotá. No representa una medición real.
        </desc>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#fff" stopOpacity=".14" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-elapsed`}>
            <rect x="68" y="0" width={Math.max(0, x(h) - 68)} height="311" />
          </clipPath>
        </defs>
        {[0, 4000, 8000].map((v) => (
          <g key={v}>
            <line
              x1="68"
              x2="1108"
              y1={310 - (v / 8000) * 248}
              y2={310 - (v / 8000) * 248}
              stroke="#303030"
              strokeDasharray={v ? "3 6" : undefined}
            />
            <text
              x="52"
              y={315 - (v / 8000) * 248}
              fill="#a4a4a0"
              textAnchor="end"
              className="solar-scale"
              fontSize="14"
            >
              {v === 0 ? "0" : v === 4000 ? "4.000" : "8.000"}
            </text>
          </g>
        ))}
        <path d={`${curve} L1108,310 L68,310 Z`} fill={`url(#${id}-fill)`} />
        {Array.from({ length: 14 }, (_, i) => i + 6).map((hour) => (
          <g key={hour}>
            <line
              x1={x(hour)}
              x2={x(hour)}
              y1={y(hour)}
              y2="310"
              stroke="#363636"
            />
            <text
              className={
                (hour % 2 && hour !== 19) || hour === 18 ? "solar-hour-minor" : undefined
              }
              x={x(hour)}
              y="343"
              textAnchor="middle"
              fill="#a4a4a0"
              fontSize="15"
            >
              {String(hour).padStart(2, "0")}:00
            </text>
          </g>
        ))}
        <path d={curve} fill="none" stroke="#555" strokeWidth="1.5" />
        <path
          d={curve}
          fill="none"
          stroke="#eee"
          strokeWidth="2"
          clipPath={`url(#${id}-elapsed)`}
        />
        {current?.active && (
          <g>
            <line
              x1={x(h)}
              x2={x(h)}
              y1={y(h)}
              y2="310"
              stroke="#ddd"
              strokeDasharray="3 5"
            />
            <circle cx={x(h)} cy={y(h)} r="19" fill="#fff" opacity=".08" />
            <circle cx={x(h)} cy={y(h)} r="10" fill="#f4f4f1" />
            <circle cx={x(h)} cy={y(h)} r="4" fill="#080808" />
          </g>
        )}
      </svg>
      <div className="solar-clock-caption">
        <span>06:00 · Inicio del ciclo</span>
        <span>
          {current
            ? current.active
              ? "Dentro del horario solar"
              : "Fuera del horario solar"
            : "Cargando hora…"}
        </span>
        <span>19:00 · Fin del ciclo</span>
      </div>
    </div>
  );
}
