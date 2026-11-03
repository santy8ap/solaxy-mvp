"use client";
import Link from "next/link";
import { PLANT } from "@/config/plant";
import { formatNumber, formatTime } from "@/lib/format";
import { useLive, useNow } from "@/lib/live/hooks";
import type { PlantReading } from "@/lib/sim";
import { DAY_MS } from "@/lib/sim";
import { sunDay } from "@/lib/sim/sun-times";
import { Odometer } from "@/components/ui/odometer";
import { SunArc } from "./sun-arc";

export function plantStatus(r: PlantReading, now: number) {
  const day = sunDay(PLANT, now);
  if (r.solarKw > 1) {
    return {
      tone: "sun" as const,
      label: "entregando ahora",
      detail:
        r.batteryKw < -1
          ? `Además carga la batería con ${formatNumber(-r.batteryKw)} kW`
          : `Irradiancia de ${formatNumber(r.irradiance)} W/m²`,
    };
  }
  if (r.batteryKw > 1) {
    return {
      tone: "dusk" as const,
      label: "entregando desde la batería",
      detail: `El sol se ocultó a las ${formatTime(day.sunset)}. Batería al ${formatNumber(r.socPct)} %`,
    };
  }
  const next = now > day.sunset ? sunDay(PLANT, now + DAY_MS).sunrise : day.sunrise;
  return { tone: "off" as const, label: "en reposo", detail: `Vuelve a generar a las ${formatTime(next)}` };
}

export function Hero() {
  const live = useLive();
  const now = useNow(1000);
  const reading = live.payload?.reading ?? null;
  const status = reading && now ? plantStatus(reading, now) : null;

  return (
    <section className="relative">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 pt-10 sm:px-8 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:pt-16">
        <div>
          <h1 className="display max-w-[13ch] text-[clamp(2.7rem,6.2vw,5.4rem)] text-silver-50">
            Sé dueño de un pedazo del sol.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-silver-300">
            Compra kW de nuestra planta solar en Antioquia, paga con Trust Wallet o cripto y mira cómo crecen tus
            ganancias con cada kWh que entrega.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ingresar" className="btn btn-sun">
              Empezar a invertir
            </Link>
            <a href="#planta" className="btn btn-ghost">
              Ver la planta en vivo
            </a>
          </div>
        </div>

        <div className="panel cells p-6 lg:mb-2" aria-live="off">
          <div className="flex items-center gap-2 text-sm text-silver-400">
            <span className="live-dot" data-tone={live.status === "simulated" ? "sim" : live.status === "live" ? undefined : "off"} />
            {live.status === "simulated" ? "Simulación de presentación" : `${PLANT.name}, en vivo`}
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <Odometer
              value={reading?.deliveredKw ?? 0}
              className={`display text-[3.4rem] ${status?.tone === "dusk" ? "text-dusk-300" : status?.tone === "off" ? "text-silver-300" : "text-sun-300"}`}
            />
            <span className="text-2xl font-semibold text-silver-300">kW</span>
          </div>
          <p className="mt-2 text-silver-100">{status?.label ?? "conectando con la planta…"}</p>
          <p className="mt-1 text-sm text-silver-400">{status?.detail ?? " "}</p>
          {live.payload && (
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-silicon-600/60 pt-4 text-sm">
              <div>
                <dt className="text-silver-400">Energía entregada hoy</dt>
                <dd className="num mt-1 text-lg font-semibold text-silver-50">{formatNumber(live.payload.today.deliveredKwh)} kWh</dd>
              </div>
              <div>
                <dt className="text-silver-400">Hora en la planta</dt>
                <dd className="num mt-1 text-lg font-semibold text-silver-50">{now ? formatTime(now) : "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-[1320px] px-2 sm:px-6">
        <SunArc now={now} reading={reading} />
      </div>
    </section>
  );
}
