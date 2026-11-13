"use client";
import { useCatalog, usePlantNow } from "@/lib/client/use-catalog";
import { cumulative, dayFraction, isGenerating, nextSunriseMs, plantPowerKw, sunsetMs } from "@/lib/energy/solar-day";
import { formatClock, formatHourLabel, formatNumber, formatTime } from "@/lib/format";
import { SolarClock } from "@/components/solar/solar-clock";

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="landing-readout min-w-0 bg-raise px-3.5 py-4 sm:px-5 sm:py-5">
      <dt className="cap">{label}</dt>
      <dd className="num mt-2 text-[clamp(1.1rem,4.4vw,1.6rem)] leading-tight">{children}</dd>
    </div>
  );
}

/** El reloj solar de la planta, con sus lecturas de este instante. */
export function ClockSection() {
  const { catalog } = useCatalog();
  const now = usePlantNow(1000);
  const solar = catalog.solar;
  const generating = now != null && isGenerating(solar, now);
  const power = now == null ? null : plantPowerKw(solar, now);
  const today = now == null ? null : cumulative(dayFraction(solar, now)) * catalog.plantDailyKwh;
  const dash = <span className="text-dim">—</span>;

  return (
    <section id="reloj" aria-labelledby="reloj-titulo" className="mx-auto max-w-[1240px] px-5 sm:px-8">
      <div className="landing-clock border border-line-strong">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-4 pt-5 sm:px-7 sm:pt-7">
          <h2 id="reloj-titulo" className="display landing-reveal text-[clamp(2.25rem,6vw,3.75rem)]">
            Reloj solar
          </h2>
          <span className="cap landing-clock-status inline-flex items-center gap-2.5 border border-line px-2.5 py-1.5">
            <span aria-hidden="true" className={`size-1.5 rounded-full ${generating ? "bg-ink" : "border border-mute"}`} />
            {now == null ? "Sincronizando hora" : generating ? "En generación" : "Fuera de horario"}
          </span>
        </div>
        <div className="px-4 sm:px-7">
          <SolarClock solar={solar} now={now} />
        </div>
        <dl className="landing-readouts grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Readout label="Hora en la planta">{now == null ? dash : formatClock(now)}</Readout>
          <Readout label="Potencia de la curva">
            {power == null ? (
              dash
            ) : (
              <>
                {formatNumber(power)} kW <span className="text-base text-mute">{Math.round((power / solar.peakKw) * 100)} %</span>
              </>
            )}
          </Readout>
          <Readout label="Generado hoy">{today == null ? dash : `${formatNumber(today)} kWh`}</Readout>
          <Readout label={generating ? "Genera hasta" : "Vuelve a generar"}>
            {now == null ? dash : formatTime(generating ? sunsetMs(solar, now) : nextSunriseMs(solar, now))}
          </Readout>
        </dl>
      </div>
      <p className="mt-6 max-w-[68ch] text-sm leading-relaxed text-mute">
        Esta es la curva de generación de {catalog.plantName}: empieza a las {formatHourLabel(solar.startHour)}, llega a su máximo de {formatNumber(solar.peakKw)} kW hacia el mediodía y termina a
        las {formatHourLabel(solar.endHour)}. Con esta misma curva se calcula, segundo a segundo, la energía de cada plan.
      </p>
    </section>
  );
}
