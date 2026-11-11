"use client";
import { useCatalog } from "@/lib/client/use-catalog";
import { useNow } from "@/lib/client/use-now";
import { cumulative, dayFraction, isGenerating, nextSunriseMs, plantPowerKw, sunsetMs } from "@/lib/energy/solar-day";
import { formatClock, formatNumber, formatTime } from "@/lib/format";
import { SolarClock } from "@/components/solar/solar-clock";

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-4 sm:border-l sm:border-t-0 sm:py-1 sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <dt className="cap">{label}</dt>
      <dd className="num mt-2 text-[1.35rem] leading-tight sm:text-[1.6rem]">{children}</dd>
    </div>
  );
}

/** El reloj solar de la planta, con sus lecturas de este instante. */
export function ClockSection() {
  const { catalog } = useCatalog();
  const now = useNow(1000);
  const solar = catalog.solar;
  const generating = now != null && isGenerating(solar, now);
  const power = now == null ? null : plantPowerKw(solar, now);
  const today = now == null ? null : cumulative(dayFraction(solar, now)) * catalog.plantDailyKwh;
  const dash = <span className="text-dim">—</span>;

  return (
    <section id="reloj" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 sm:px-8">
      <SolarClock solar={solar} now={now} />
      <dl className="mt-10 grid grid-cols-2 gap-x-6 sm:mt-8 sm:grid-cols-4 sm:gap-x-0">
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
      <p className="mt-6 max-w-[68ch] text-sm leading-relaxed text-mute">
        Esta es la curva de generación de {catalog.plantName}: empieza a las 6 a. m., llega a su máximo de {formatNumber(solar.peakKw)} kW a mediodía y termina a las 7 p. m. Con esta misma curva se
        calcula, segundo a segundo, la energía de cada plan.
      </p>
    </section>
  );
}
