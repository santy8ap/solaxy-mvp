"use client";
import { animate } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLANT } from "@/config/plant";
import { formatHourLabel, formatTime } from "@/lib/format";
import { useReducedMotion } from "@/lib/live/hooks";
import { HOUR_MS, dayStartMs, localDayIndex, type PlantReading } from "@/lib/sim";
import { sunDay, sunElevation } from "@/lib/sim/sun-times";

const W = 1200;
const H = 540;
const HORIZON = 372;
const LEFT = 70;
const RIGHT = 1130;
const TOP = 54;
const ARRAY_RIGHT = RIGHT - 150;

const STARS = Array.from({ length: 38 }, (_, i) => {
  const r = Math.sin(i * 12.9898) * 43758.5453;
  const f = r - Math.floor(r);
  const r2 = Math.sin(i * 78.233) * 12543.123;
  const g = r2 - Math.floor(r2);
  // Redondeado: Node y el navegador pueden diferir en el último decimal de Math.sin.
  return { x: Math.round(40 + f * (W - 80)), y: Math.round(20 + g * (HORIZON - 70)), s: 0.6 + ((i * 7) % 5) * 0.25 };
});

interface Props {
  now: number | null;
  reading: PlantReading | null;
  /** Para el panel: menos detalle y sin estrellas */
  compact?: boolean;
  /** Capacidad AC de la planta (para iluminar los paneles en proporción) */
  acCapacityKw?: number;
}

/**
 * El cielo de la planta ahora mismo: el arco real que recorre el sol hoy (NOAA),
 * el sol en su posición actual y los paneles iluminados según la potencia.
 * De noche el sol baja del horizonte y la batería toma el relevo.
 */
export function SunArc({ now, reading, compact = false, acCapacityKw = PLANT.acCapacityKw }: Props) {
  const reduced = useReducedMotion();
  const day = useMemo(() => (now ? sunDay(PLANT, now) : null), [now]);
  const span = day ? day.sunset - day.sunrise : 1;

  const point = (t: number) => {
    if (!day) return { x: LEFT, y: HORIZON };
    const u = (t - day.sunrise) / span;
    const e = Math.max(0, sunElevation(PLANT, t));
    return { x: LEFT + (RIGHT - LEFT) * u, y: HORIZON - (HORIZON - TOP) * (e / day.maxElevation) };
  };

  const path = useMemo(() => {
    if (!day) return "";
    const pts = Array.from({ length: 73 }, (_, i) => {
      const t = day.sunrise + (span * i) / 72;
      const u = (t - day.sunrise) / span;
      const e = Math.max(0, sunElevation(PLANT, t));
      return `${(LEFT + (RIGHT - LEFT) * u).toFixed(1)},${(HORIZON - (HORIZON - TOP) * (e / day.maxElevation)).toFixed(1)}`;
    });
    return `M${pts.join(" L")}`;
  }, [day, span]);

  const isDay = !!(now && day && now >= day.sunrise && now <= day.sunset);
  const target = now && day ? Math.min(1, Math.max(0, (now - day.sunrise) / span)) : 0;

  // Entrada orquestada: el sol sale desde el amanecer hasta su posición actual.
  const [progress, setProgress] = useState(0);
  const entered = useRef(false);
  useEffect(() => {
    if (!now) return;
    if (entered.current || reduced) {
      setProgress(target);
      return;
    }
    entered.current = true;
    const controls = animate(0, target, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setProgress(v),
    });
    return () => controls.stop();
  }, [now, target, reduced]);

  const sunT = day ? day.sunrise + span * progress : 0;
  const sun = isDay ? point(sunT) : { x: now && day && now > day.sunset ? RIGHT - 40 : LEFT + 40, y: HORIZON + 70 };
  const solarFactor = reading ? Math.min(1, reading.solarKw / (acCapacityKw * 0.85)) : 0;
  const battery = reading ? Math.max(0, reading.batteryKw) : 0;
  const soc = reading ? reading.socPct / 100 : 0.1;
  const discharging = battery > 1;
  const charging = !!reading && reading.batteryKw < -1;

  const hourPoints =
    day && now ? [9, 12, 15].map((h) => ({ h, ...point(dayStartMs(localDayIndex(now)) + h * HOUR_MS) })) : [];

  const rows = compact ? [{ y: HORIZON + 22, h: 46, n: 16 }] : [
    { y: HORIZON + 20, h: 40, n: 18 },
    { y: HORIZON + 74, h: 52, n: 16 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${compact ? HORIZON + 90 : H}`} className="h-auto w-full" role="img" aria-label="Posición del sol y estado de la planta solar en este momento">
      <defs>
        <radialGradient id="arc-sun-core" cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.45" stopColor="#ffd071" />
          <stop offset="1" stopColor="#e39b22" />
        </radialGradient>
        <radialGradient id="arc-sun-glow">
          <stop offset="0" stopColor="#f6b73c" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ff7a3d" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ff7a3d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="arc-night-glow">
          <stop offset="0" stopColor="#8b6cf0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#8b6cf0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="arc-trail" x1="0" x2="1">
          <stop offset="0" stopColor="#ff7a3d" stopOpacity="0.2" />
          <stop offset="1" stopColor="#f6b73c" />
        </linearGradient>
        <pattern id="arc-cells" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" rx="1.4" fill="#1b2d5e" />
        </pattern>
        <linearGradient id="arc-glint" x1="0" x2="1" gradientUnits="objectBoundingBox">
          <stop offset="0.35" stopColor="#ffe3a3" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffe3a3" stopOpacity="0.55" />
          <stop offset="0.65" stopColor="#ffe3a3" stopOpacity="0" />
          {!reduced && (
            <animateTransform attributeName="gradientTransform" type="translate" values="-1 0; 1.4 0" dur="7s" repeatCount="indefinite" />
          )}
        </linearGradient>
        <clipPath id="arc-sky">
          <rect x="0" y="0" width={W} height={HORIZON} />
        </clipPath>
      </defs>

      {/* Cielo nocturno */}
      {!compact && (
        <g opacity={isDay ? 0 : 1} style={{ transition: "opacity 1.2s" }}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#e6ebf5" opacity={[0.35, 0.5, 0.65][i % 3]} />
          ))}
        </g>
      )}

      {/* Resplandor del sol o de la batería */}
      <g clipPath="url(#arc-sky)">
        {isDay && <circle cx={sun.x} cy={sun.y} r={compact ? 150 : 230} fill="url(#arc-sun-glow)" />}
      </g>
      {!isDay && now && <circle cx={RIGHT - 70} cy={HORIZON + 40} r={discharging ? 220 : 120} fill="url(#arc-night-glow)" style={{ transition: "r 1s" }} />}

      {/* Recorrido del sol hoy */}
      {path && (
        <>
          <path d={path} fill="none" stroke="#8e9ac0" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
          <path d={path} pathLength={1} fill="none" stroke="url(#arc-trail)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${progress} 1`} />
        </>
      )}

      {/* Horas */}
      {day && (
        <g fontSize={compact ? 30 : 15} fill="#8e9ac0" style={{ fontVariantNumeric: "tabular-nums" }}>
          <text x={LEFT} y={HORIZON - (compact ? 20 : 14)} textAnchor="start">{formatTime(day.sunrise)}</text>
          <text x={RIGHT} y={HORIZON - (compact ? 20 : 14)} textAnchor="end">{formatTime(day.sunset)}</text>
          {!compact &&
            hourPoints.map((p) => (
              <g key={p.h}>
                <circle cx={p.x} cy={p.y} r="3" fill="#8e9ac0" />
                <text x={p.x} y={p.y - 14} textAnchor="middle">{formatHourLabel(p.h)}</text>
              </g>
            ))}
        </g>
      )}

      {/* Horizonte */}
      <line x1="0" x2={W} y1={HORIZON} y2={HORIZON} stroke="#b7c1da" strokeOpacity="0.35" strokeWidth="1" />

      {/* Sol */}
      {now && (
        <g transform={`translate(${sun.x} ${sun.y})`} opacity={isDay ? 1 : 0.35} style={{ transition: "opacity 1s" }}>
          <circle r={compact ? 30 : 42} fill="#f6b73c" opacity="0.25" style={{ transformBox: "fill-box", transformOrigin: "center", animation: reduced ? undefined : "sun-breathe 4.5s ease-in-out infinite" }} />
          <circle r={compact ? 15 : 21} fill="url(#arc-sun-core)" />
        </g>
      )}

      {/* Paneles: se iluminan según la potencia */}
      {rows.map((row, r) => {
        const width = (ARRAY_RIGHT - LEFT) / row.n;
        const lean = row.h * 0.42;
        return (
          <g key={r}>
            {Array.from({ length: row.n }, (_, i) => {
              const x0 = LEFT + i * width + (r === 1 ? -18 : 0);
              const pts = `${x0 + lean},${row.y} ${x0 + width - 6 + lean},${row.y} ${x0 + width - 6},${row.y + row.h} ${x0},${row.y + row.h}`;
              const shimmer = 0.75 + 0.25 * Math.sin(i * 1.7 + r);
              return (
                <g key={i}>
                  <polygon points={pts} fill="#0d1937" stroke="#34488a" strokeOpacity="0.7" strokeWidth="1" />
                  <polygon points={pts} fill="url(#arc-cells)" />
                  <polygon
                    points={pts}
                    fill="#f6b73c"
                    opacity={solarFactor * 0.42 * shimmer}
                    style={{ transition: `opacity 900ms ${reduced ? 0 : (i + r * 6) * 35}ms` }}
                  />
                </g>
              );
            })}
            {solarFactor > 0.05 && (
              <polygon
                points={`${LEFT + lean},${row.y} ${ARRAY_RIGHT + lean},${row.y} ${ARRAY_RIGHT},${row.y + row.h} ${LEFT},${row.y + row.h}`}
                fill="url(#arc-glint)"
                opacity={solarFactor * 0.6}
              />
            )}
          </g>
        );
      })}

      {/* Batería */}
      {now && (
        <g transform={`translate(${RIGHT - 118} ${compact ? HORIZON + 24 : HORIZON + 34})`}>
          <rect x="0" y="0" width="96" height="46" rx="9" fill="#0d1937" stroke={discharging ? "#a68bff" : "#34488a"} strokeWidth="1.5" />
          <rect x="96" y="15" width="7" height="16" rx="2.5" fill={discharging ? "#a68bff" : "#34488a"} />
          <rect x="5" y="5" width={Math.max(4, 86 * soc)} height="36" rx="5" fill="#8b6cf0" opacity={discharging ? 0.95 : 0.6} style={{ transition: "width 1s" }} />
          {charging && <path d="M50 12 l-9 13 h8 l-4 10 l12 -15 h-8 l4 -8z" fill="#ffe3a3" />}
        </g>
      )}
    </svg>
  );
}
