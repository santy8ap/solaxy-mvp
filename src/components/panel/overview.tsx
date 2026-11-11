"use client";
import Link from "next/link";
import type { PortfolioDTO } from "@/lib/portfolio";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatDateTime, formatKw, formatNumber, formatPct } from "@/lib/format";
import { useLive, useNow } from "@/lib/live/hooks";
import { Odometer } from "@/components/ui/odometer";
import { SunArc } from "@/components/landing/sun-arc";
import { plantStatus } from "@/components/landing/hero";
import { DailyChart, GrowthChart } from "./charts";
import { EnergyFlow } from "./energy-flow";
import { Topbar } from "./shell";
import { txAmount, txDetail, txTitle } from "./tx-meta";
import { useLiveEarnings } from "./use-live-earnings";

interface RatesDTO {
  prices: { USDT: { cop: number } };
}

export function Overview() {
  const { data: p, error } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 30_000 });
  const { data: rates } = useJson<RatesDTO>("/api/rates", { refreshMs: 120_000 });
  const live = useLive();
  const now = useNow(1000);
  const earn = useLiveEarnings(p);
  const reading = live.payload?.reading ?? null;
  const status = reading && now ? plantStatus(reading, now) : null;

  if (error && !p) {
    return (
      <>
        <Topbar />
        <div className="panel p-8 text-silver-300">No pudimos cargar tu portafolio: {error}. Revisa que el servidor esté encendido y recarga la página.</div>
      </>
    );
  }

  const usdt = rates ? (earn?.earned ?? p?.earnedCop ?? 0) / rates.prices.USDT.cop : null;

  return (
    <>
      <Topbar />

      {/* Ganancias en vivo + el cielo de la planta */}
      <section className="panel cells grid overflow-hidden lg:grid-cols-[1.15fr_1fr]" aria-label="Tus ganancias en vivo">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-sm text-silver-400">
            <span className="live-dot" data-tone={earn?.simulated ? "sim" : undefined} />
            {earn?.simulated ? "Ganancias (simulación acelerada)" : "Tus ganancias estimadas"}
          </div>
          <div className="mt-4 text-[clamp(1.75rem,7.6vw,4.4rem)]">
            {p ? <Odometer value={earn?.earned ?? p.earnedCop} decimals={2} prefix={"$\u00a0"} className="display text-silver-50" /> : <span className="display text-silver-500">$ —</span>}
          </div>
          <p className="num mt-3 text-silver-400">{usdt != null ? `≈ ${formatNumber(usdt, 6)} USDT` : " "}</p>
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-silver-400">Hoy</dt>
              <dd className="num mt-1 text-xl font-semibold text-leaf-300">+{formatCop(earn?.today ?? p?.earnedTodayCop ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-sm text-silver-400">Ritmo actual</dt>
              <dd className="num mt-1 text-xl font-semibold text-silver-50">{formatCop(earn?.ratePerHour ?? 0)} / hora</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-sm text-silver-400">Tu potencia ahora</dt>
              <dd className="num mt-1 text-xl font-semibold text-silver-50">{formatKw(earn?.myKw ?? 0)}</dd>
            </div>
          </dl>
        </div>
        <div className="relative border-t border-silicon-600/40 p-4 lg:border-l lg:border-t-0">
          <SunArc now={now} reading={reading} compact />
          <p className="px-3 pb-2 text-sm text-silver-300">
            <span className={status?.tone === "dusk" ? "text-dusk-300" : status?.tone === "sun" ? "text-sun-300" : "text-silver-400"}>
              La planta está {status?.label ?? "conectando"}
            </span>
            {status ? `. ${status.detail}.` : ""}
          </p>
        </div>
      </section>

      {/* Indicadores */}
      <section className="mt-5 grid overflow-hidden rounded-[var(--radius-panel)] border border-silicon-600/50 bg-silicon-600/50 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }} aria-label="Indicadores">
        {[
          ["Capital invertido", p ? formatCop(p.investedCop) : "—", p ? `${formatKw(p.kw, 1)} comprados` : ""],
          ["Tus kW en la planta", p ? formatKw(p.kw, 1) : "—", p ? `${formatNumber(p.sharePct, 2)} % de ${formatNumber(p.capacityKwp)} kWp` : ""],
          ["Rentabilidad estimada", p ? `${formatPct(p.yieldEa)} E.A.` : "—", "según los últimos 30 días"],
          ["CO₂ que evitaste", p ? `${formatNumber(p.co2Kg)} kg` : "—", p ? `como ${formatNumber(p.trees)} árboles en un año` : ""],
        ].map(([k, v, s]) => (
          <div key={k} className="bg-silicon-850 p-5">
            <div className="text-sm text-silver-400">{k}</div>
            <div className="num mt-2 text-2xl font-semibold text-silver-50">{v}</div>
            <div className="mt-1 text-sm text-silver-500">{s}</div>
          </div>
        ))}
      </section>

      {/* Flujo de energía */}
      <section className="panel mt-5 p-5 sm:p-7" aria-labelledby="flow-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="flow-title" className="text-lg font-semibold text-silver-50">
            Del sol a tu billetera
          </h2>
          <span className="text-sm text-silver-400">Valores en vivo de la planta</span>
        </div>
        <EnergyFlow reading={reading} myKw={earn?.myKw ?? 0} ratePerHour={earn?.ratePerHour ?? 0} />
      </section>

      {/* Gráficas */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-7" aria-labelledby="growth-title">
          <h2 id="growth-title" className="text-lg font-semibold text-silver-50">
            Cómo crecen tus ganancias
          </h2>
          <p className="mb-4 mt-1 text-sm text-silver-400">Acumulado de los últimos 90 días</p>
          {p ? <GrowthChart p={p} liveEarned={earn?.earned} /> : <div className="h-[260px] animate-pulse rounded-none bg-silicon-800/60" />}
        </section>
        <section className="panel p-5 sm:p-7" aria-labelledby="daily-title">
          <h2 id="daily-title" className="text-lg font-semibold text-silver-50">
            Lo que ganas cada día
          </h2>
          <p className="mb-4 mt-1 text-sm text-silver-400">Últimos 30 días; los días nublados ganas menos</p>
          {p ? <DailyChart p={p} liveToday={earn?.today} /> : <div className="h-[260px] animate-pulse rounded-none bg-silicon-800/60" />}
        </section>
      </div>

      {/* Movimientos */}
      <section className="panel mt-5 p-5 sm:p-7" aria-labelledby="tx-title">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="tx-title" className="text-lg font-semibold text-silver-50">
            Últimos movimientos
          </h2>
          <Link href="/panel/billetera" className="text-sm text-sun-300 hover:text-sun-200">
            Ver todos
          </Link>
        </div>
        <ul className="divide-y divide-silicon-600/40">
          {(p?.transactions ?? []).slice(0, 5).map((t) => {
            const amt = txAmount(t);
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <div className="truncate font-medium text-silver-50">{txTitle(t)}</div>
                  <div className="truncate text-sm text-silver-400">
                    {formatDateTime(t.createdAt)}
                    {txDetail(t) ? `, ${txDetail(t)}` : ""}
                  </div>
                </div>
                <div className={`num shrink-0 text-right font-semibold ${amt.tone}`}>{amt.text}</div>
              </li>
            );
          })}
          {p && p.transactions.length === 0 && (
            <li className="py-6 text-silver-400">
              Aún no tienes movimientos.{" "}
              <Link href="/panel/mercado" className="text-sun-300">
                Compra tus primeros kW
              </Link>
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
