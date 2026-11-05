"use client";
import { PLANT } from "@/config/plant";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatCopCompact, formatDateTime, formatKwh, formatNumber, formatPct } from "@/lib/format";
import { useLive } from "@/lib/live/hooks";
import { Topbar } from "./shell";

interface PlatformDTO {
  capacityKwp: number;
  soldKw: number;
  availableKw: number;
  investors: number;
  capitalCop: number;
  pricePerKwCop: number;
  lifetimeKwh: number;
  co2AvoidedKg: number;
  lifetimeNetPerKwp: number;
  commissionPct: number;
  tariffDayCop: number;
  tariffPeakCop: number;
  recent: { name: string; kw: number | null; asset: string | null; walletName: string | null; at: number }[];
}

/** Vista para socios: cómo va el negocio, no un inversionista individual. */
export function Partners() {
  const { data: d } = useJson<PlatformDTO>("/api/platform", { refreshMs: 30_000 });
  const live = useLive();
  const today = live.payload?.today;
  const sold = d ? d.soldKw / d.capacityKwp : 0;
  const lifetimeRevenueNet = d ? d.lifetimeNetPerKwp * d.capacityKwp : 0;
  const netFactor = 1 - (d?.commissionPct ?? 18) / 100;
  const lifetimeGross = lifetimeRevenueNet / netFactor;
  const platformShare = lifetimeGross - lifetimeRevenueNet;

  return (
    <>
      <Topbar title="Vista de socios" subtitle="Cómo va Solaxy como negocio: capital, energía vendida y comunidad." />

      <section className="grid overflow-hidden rounded-[var(--radius-panel)] border border-silicon-600/50 bg-silicon-600/50 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }} aria-label="Indicadores del negocio">
        {[
          ["Capital levantado", d ? formatCopCompact(d.capitalCop) : "—", d ? `${formatNumber(d.soldKw, 1)} kW vendidos` : ""],
          ["Planta vendida", d ? formatPct(sold, 1) : "—", d ? `${formatNumber(d.availableKw, 1)} kW disponibles` : ""],
          ["Inversionistas", d ? formatNumber(d.investors) : "—", "con kW activos"],
          ["Energía entregada", d ? formatKwh(d.lifetimeKwh) : "—", `${formatNumber((d?.co2AvoidedKg ?? 0) / 1000)} t de CO₂ evitadas`],
        ].map(([k, v, s]) => (
          <div key={k} className="bg-silicon-850 p-5">
            <div className="text-sm text-silver-400">{k}</div>
            <div className="num mt-2 text-2xl font-semibold text-silver-50">{v}</div>
            <div className="mt-1 text-sm text-silver-500">{s}</div>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-6 sm:p-8" aria-labelledby="rev-title">
          <h2 id="rev-title" className="text-lg font-semibold text-silver-50">
            Ingresos por venta de energía
          </h2>
          <p className="mt-1 text-sm text-silver-400">Desde la puesta en marcha, hace {PLANT.commissionedDaysAgo} días</p>
          <dl className="mt-6 space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-silver-300">Ingreso bruto de la planta</dt>
              <dd className="num text-xl font-semibold text-silver-50">{formatCop(lifetimeGross)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-silver-300">Repartido a inversionistas ({formatPct(netFactor, 0)})</dt>
              <dd className="num text-xl font-semibold text-leaf-300">{formatCop(lifetimeRevenueNet)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-silver-300">Operación y plataforma ({formatPct(1 - netFactor, 0)})</dt>
              <dd className="num text-xl font-semibold text-sun-300">{formatCop(platformShare)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-silicon-600/50 pt-4">
              <dt className="text-silver-300">Ingreso neto de hoy (en vivo)</dt>
              <dd className="num text-xl font-semibold text-silver-50">{formatCop(today?.netCop ?? 0)}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-silver-500">
            Modelo: la energía se vende a {formatCop(d?.tariffDayCop ?? 0)}/kWh en el día y a {formatCop(d?.tariffPeakCop ?? 0)}/kWh en la hora pico con la batería. Las ganancias son estimadas con la telemetría simulada de la planta.
          </p>
        </section>

        <section className="panel p-6 sm:p-8" aria-labelledby="recent-title">
          <h2 id="recent-title" className="text-lg font-semibold text-silver-50">
            Compras recientes
          </h2>
          <ul className="mt-4 divide-y divide-silicon-600/40">
            {(d?.recent ?? []).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <div className="text-silver-50">{r.name}</div>
                  <div className="text-xs text-silver-500">
                    {formatDateTime(r.at)}
                    {r.walletName ? `, ${r.walletName}` : ""}
                  </div>
                </div>
                <div className="num text-right text-silver-100">
                  {formatNumber(r.kw ?? 0, 1)} kW
                  <div className="text-xs text-silver-500">{r.asset}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
