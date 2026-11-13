"use client";
import { Clock3, Sun, Sunrise, Sunset } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useCatalog } from "@/lib/client/use-catalog";
import { useNow } from "@/lib/client/use-now";
import { cumulative, dayFraction, nextSunriseMs, shape, sunsetMs } from "@/lib/energy/solar-day";
import { formatClock, formatHourLabel, formatNumber, formatTime } from "@/lib/format";
import { dayStartMs, MINUTE_MS } from "@/lib/time";
import { SolarClock } from "@/components/solar/solar-clock";

const STEP_MINUTES = 15;

function formatSolarMinute(minute: number) {
  return formatTime(dayStartMs(0) + minute * MINUTE_MS);
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="landing-readout min-w-0 bg-raise px-3.5 py-4 sm:px-5 sm:py-5">
      <dt className="cap">{label}</dt>
      <dd className="num mt-2 text-[clamp(1.1rem,4.4vw,1.6rem)] leading-tight">{children}</dd>
    </div>
  );
}

/** Lecturas de la curva solar y exploración del horario de generación. */
export function ClockSection() {
  const { catalog, clockOffset } = useCatalog();
  const now = useNow(1000, clockOffset);
  const rangeId = useId();
  const range = useRef<HTMLInputElement>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const solar = catalog.solar;
  const firstMinute = solar.startHour * 60;
  const lastMinute = solar.endHour * 60;
  const duration = lastMinute - firstMinute;
  const liveFraction = now == null ? null : dayFraction(solar, now);
  const generating = liveFraction != null && liveFraction > 0 && liveFraction < 1;
  const liveMinute = firstMinute + Math.round((liveFraction ?? 0) * duration / STEP_MINUTES) * STEP_MINUTES;
  const exploring = selectedMinute !== null;
  const minute = Math.max(firstMinute, Math.min(lastMinute, selectedMinute ?? liveMinute));
  const minuteLabel = formatSolarMinute(minute);
  const preview = exploring ? (minute - firstMinute) / duration : undefined;
  const fraction = preview ?? liveFraction;
  const power = fraction == null ? null : solar.peakKw * shape(fraction);
  const progress = fraction == null ? null : cumulative(fraction);
  const energy = progress == null ? null : progress * catalog.plantDailyKwh;
  const moments = [
    { label: "Amanecer", minute: firstMinute, icon: Sunrise },
    { label: "Pico solar", minute: firstMinute + duration / 2, icon: Sun },
    { label: "Atardecer", minute: lastMinute, icon: Sunset },
  ];
  const status = exploring ? "Hora consultada" : now == null ? "Sincronizando hora" : generating ? "En horario solar" : "Fuera de horario";
  const dash = <span className="text-dim">—</span>;

  return (
    <section id="reloj" aria-labelledby="reloj-titulo" className="mx-auto max-w-[1240px] px-5 sm:px-8">
      <div className="landing-clock border border-line-strong" data-exploring={exploring}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-4 pt-5 sm:px-7 sm:pt-7">
          <h2 id="reloj-titulo" className="display landing-reveal text-[clamp(2.25rem,6vw,3.75rem)]">
            Reloj solar
          </h2>
          <span className="cap landing-clock-status inline-flex items-center gap-2.5 border border-line px-2.5 py-1.5">
            <span aria-hidden="true" className={`size-1.5 rounded-full ${exploring || generating ? "bg-current" : "border border-mute"}`} />
            {status}
          </span>
        </div>
        <div className="px-4 sm:px-7">
          <SolarClock solar={solar} now={now} previewFraction={preview} />
        </div>
        <div className="landing-clock-controls border-t border-line px-4 py-4 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <label htmlFor={rangeId} className="text-sm font-medium">
              Explorar por hora
            </label>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-fog enabled:hover:text-ink disabled:text-mute"
              disabled={!exploring}
              onClick={() => {
                setSelectedMinute(null);
                range.current?.focus();
              }}
            >
              <Clock3 aria-hidden="true" size={15} />
              Volver a ahora
            </button>
          </div>
          <input
            ref={range}
            id={rangeId}
            type="range"
            min={firstMinute}
            max={lastMinute}
            step={STEP_MINUTES}
            value={minute}
            onChange={(event) => setSelectedMinute(event.currentTarget.valueAsNumber)}
            aria-valuetext={minuteLabel}
            className="landing-clock-range block h-11 w-full cursor-pointer"
          />
          <div role="group" aria-label="Momentos del día" className="grid grid-cols-3 gap-1 sm:gap-3">
            {moments.map(({ label, minute: momentMinute, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-pressed={exploring && minute === momentMinute}
                onClick={() => setSelectedMinute(momentMinute)}
                className="landing-clock-moment flex min-h-11 flex-col items-center justify-center gap-1 border border-line px-1 py-2 text-xs font-medium sm:flex-row sm:gap-2"
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.6} />
                {label}
                <span className="num text-mute">{formatSolarMinute(momentMinute)}</span>
              </button>
            ))}
          </div>
        </div>
        <dl className="landing-readouts grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Readout label={exploring ? "Hora consultada" : "Hora en la planta"}>
            {exploring ? minuteLabel : now == null ? dash : formatClock(now)}
          </Readout>
          <Readout label="Potencia estimada">
            {power == null ? (
              dash
            ) : (
              <>
                {formatNumber(power)} kW <span className="text-base text-mute">{Math.round((power / solar.peakKw) * 100)} %</span>
              </>
            )}
          </Readout>
          <Readout label={exploring ? "Energía acumulada estimada" : "Energía estimada hoy"}>
            {energy == null ? dash : `${formatNumber(energy)} kWh`}
          </Readout>
          {exploring ? (
            <Readout label="Del total diario">{progress == null ? dash : `${formatNumber(progress * 100)} %`}</Readout>
          ) : (
            <Readout label={generating ? "Fin del horario solar" : "Próximo horario solar"}>
              {now == null ? dash : formatTime(generating ? sunsetMs(solar, now) : nextSunriseMs(solar, now))}
            </Readout>
          )}
        </dl>
        <span className="sr-only" role="status">
          {exploring && power != null && energy != null
            ? `${minuteLabel}, ${formatNumber(power)} kW de potencia y ${formatNumber(energy)} kWh acumulados según la curva.`
            : ""}
        </span>
      </div>
      <p className="mt-6 max-w-[68ch] text-sm leading-relaxed text-mute">
        La curva estima la generación de {catalog.plantName} entre las {formatHourLabel(solar.startHour)} y las {formatHourLabel(solar.endHour)}, hora de Colombia.
        Su máximo es de {formatNumber(solar.peakKw)} kW. Con esta curva se calcula la energía de cada plan.
      </p>
    </section>
  );
}
