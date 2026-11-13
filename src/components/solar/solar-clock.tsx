"use client";
import { useId } from "react";
import type { SolarDay } from "@/config/solar";
import { dayFraction, plantPowerKw, shape, solarHours } from "@/lib/energy/solar-day";
import { formatNumber, formatTime } from "@/lib/format";

/**
 * Reloj solar: la campana de generación de la planta, de la hora en que empieza a la hora en que termina,
 * con una línea por cada hora (como el dibujo del cliente). El sol es el eclipse de la marca y recorre
 * la curva en tiempo real; brilla más cuanto más genera la planta.
 *
 * La geometría se estira al ancho disponible; el sol y los textos van aparte para no deformarse.
 */

const W = 1000;
const H = 400;
const X0 = 28;
const X1 = 972;
const BASE = 318;
const TOP = 70;
const SAMPLES = 96;

const xOf = (f: number) => X0 + f * (X1 - X0);
const yOf = (s: number) => BASE - s * (BASE - TOP);
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

function curvePath(until = 1) {
  const n = Math.max(1, Math.round(SAMPLES * until));
  let d = "";
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * until;
    d += `${i ? "L" : "M"}${xOf(f).toFixed(1)} ${yOf(shape(f)).toFixed(1)}`;
  }
  return d;
}

const FULL_CURVE = curvePath();

/** "6 a. m." y "7 p. m." en los extremos, "12 m." al mediodía y solo el número en las demás. */
function hourLabel(hour: number, isEnd: boolean) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  if (hour === 12) return "12 m.";
  if (!isEnd) return String(h12);
  return `${h12} ${hour < 12 ? "a. m." : "p. m."}`;
}

export interface SolarClockProps {
  solar: SolarDay;
  /** Hora actual sincronizada con el servidor; null antes de hidratar (se dibuja la curva sin el sol). */
  now: number | null;
  /** "hero": grande, para el inicio. "panel": compacto, para el panel de la empresa. */
  size?: "hero" | "panel";
  className?: string;
}

export function SolarClock({ solar, now, size = "hero", className = "" }: SolarClockProps) {
  const fillId = useId();
  const hero = size === "hero";
  const hours = solarHours(solar);
  const marks = Array.from({ length: hours + 1 }, (_, i) => solar.startHour + i);
  const f = now == null ? null : dayFraction(solar, now);
  const s = f == null ? 0 : shape(f);
  const generating = f != null && f > 0 && f < 1;
  const power = now == null ? 0 : plantPowerKw(solar, now);
  const elapsedCurve = f != null && f > 0 ? (f === 1 ? FULL_CURVE : curvePath(f)) : null;

  const label =
    now == null
      ? `Reloj solar: la planta genera de ${hourLabel(solar.startHour, true)} a ${hourLabel(solar.endHour, true)}, con un máximo de ${formatNumber(solar.peakKw)} kW.`
      : generating
        ? `Reloj solar: son las ${formatTime(now)} y la curva de la planta va en ${formatNumber(power)} kW, el ${Math.round(s * 100)} % de su máximo de ${formatNumber(solar.peakKw)} kW.`
        : `Reloj solar: son las ${formatTime(now)}. La planta genera de ${hourLabel(solar.startHour, true)} a ${hourLabel(solar.endHour, true)}.`;

  return (
    <div role="img" aria-label={label} className={`@container relative w-full select-none ${hero ? "aspect-[4/3] sm:aspect-[5/2]" : "aspect-[16/10] sm:aspect-[2/1]"} ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {hero && (
          <defs>
            <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--solar-halo))" stopOpacity="0.21" />
              <stop offset="100%" stopColor="rgb(var(--solar-halo))" stopOpacity="0.015" />
            </linearGradient>
          </defs>
        )}
        {/* Guías: 100 % y 50 % de la potencia máxima */}
        {[1, 0.5].map((level) => (
          <line key={level} x1={0} x2={W} y1={yOf(level)} y2={yOf(level)} stroke="currentColor" strokeOpacity="0.16" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Lo que ya se generó hoy */}
        {elapsedCurve && f != null && (
          <path
            d={`${elapsedCurve}L${xOf(f).toFixed(1)} ${BASE}L${X0} ${BASE}Z`}
            fill={hero ? `url(#${fillId})` : "currentColor"}
            fillOpacity={hero ? 1 : 0.09}
          />
        )}
        {/* Una línea por cada hora, del horizonte a la curva */}
        {marks.map((h) => {
          const hf = (h - solar.startHour) / hours;
          return <line key={h} x1={xOf(hf)} x2={xOf(hf)} y1={BASE} y2={yOf(shape(hf))} stroke="currentColor" strokeOpacity={f != null && hf <= f ? 0.5 : 0.22} vectorEffect="non-scaling-stroke" />;
        })}
        {/* La campana */}
        <path d={FULL_CURVE} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {elapsedCurve && (
          <path
            d={elapsedCurve}
            fill="none"
            stroke={hero ? "rgb(var(--solar-halo))" : "currentColor"}
            strokeWidth={hero ? "2.2" : "1.8"}
            pathLength={hero ? 1 : undefined}
            data-solar-trace={hero ? "" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {hero && generating && (
          <line x1={xOf(f)} x2={xOf(f)} y1={yOf(s)} y2={BASE} stroke="rgb(var(--solar-halo))" strokeOpacity="0.55" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        )}
        {/* El horizonte */}
        <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="currentColor" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />
        {/* Marcas de hora bajo el horizonte */}
        {marks.map((h) => {
          const hf = (h - solar.startHour) / hours;
          return <line key={h} x1={xOf(hf)} x2={xOf(hf)} y1={BASE} y2={BASE + 7} stroke="currentColor" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>

      {/* Rótulos de las guías */}
      <span className="num absolute left-0 -translate-y-full pb-1 text-[0.6875rem] text-mute" style={{ top: pct(yOf(1), H) }}>
        {formatNumber(solar.peakKw)} kW
      </span>
      <span className="num absolute left-0 -translate-y-full pb-1 text-[0.6875rem] text-mute" style={{ top: pct(yOf(0.5), H) }}>
        {formatNumber(solar.peakKw / 2)} kW <span className="text-dim">50 %</span>
      </span>

      {/* Horas */}
      {marks.map((h, i) => {
        const hf = (h - solar.startHour) / hours;
        const isEnd = i === 0 || i === marks.length - 1;
        // Se conservan las marcas de cada hora y se espacian sus rótulos en pantallas estrechas.
        const hideWhenNarrow = !isEnd && (i % 3 !== 0 || i >= marks.length - 3);
        return (
          <span
            key={h}
            className={`num absolute whitespace-nowrap pt-2.5 text-[0.6875rem] text-mute ${i === 0 ? "" : i === marks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"} ${hideWhenNarrow ? "@max-[560px]:hidden" : ""}`}
            style={{ left: pct(xOf(hf), W), top: pct(BASE + 7, H) }}
          >
            {hourLabel(h, isEnd)}
          </span>
        );
      })}

      {/* El sol: el eclipse de la marca. Su halo crece con la potencia. */}
      {f != null && (
        <span
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-disc motion-safe:transition-[left,top] motion-safe:duration-1000 motion-safe:ease-linear ${hero ? "size-7 @min-[560px]:size-[54px]" : "size-[38px]"}`}
          style={{
            left: pct(xOf(f), W),
            top: pct(yOf(s), H),
            boxShadow: generating
              ? `0 0 0 1.5px rgb(var(--solar-halo) / 0.96), 0 0 ${10 + 10 * s}px ${1 + 2 * s}px rgb(var(--solar-halo) / ${0.3 + 0.35 * s}), 0 0 ${40 + 40 * s}px ${8 + 14 * s}px rgb(var(--solar-halo) / ${0.06 + 0.14 * s}), 0 0 ${120 + 80 * s}px ${30 + 40 * s}px rgb(var(--solar-halo) / ${0.02 + 0.05 * s})`
              : "0 0 0 1.5px rgb(var(--solar-halo) / 0.4)",
          }}
        >
          {hero && generating && (
            <span className="pointer-events-none absolute -inset-2 rounded-full border border-ink/30 motion-safe:animate-[solar-halo-in_950ms_var(--ease-out-soft)_both]" />
          )}
        </span>
      )}
    </div>
  );
}
