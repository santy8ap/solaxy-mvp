"use client";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCatalog } from "@/lib/client/use-catalog";
import { planCheckoutHref } from "@/lib/navigation";
import { ErrorNote } from "@/components/ui/field";
import { formatCop, formatNumber, formatPct } from "@/lib/format";
import { PlansTable } from "@/components/plans/plans-table";
import { ProfitPreview } from "@/components/plans/profit-preview";

/** Los planes, con sus precios vigentes. Para comprar hay que ingresar. */
export function PlansSection() {
  const { catalog, loaded, error, reload } = useCatalog();
  return (
    <section
      id="planes"
      aria-labelledby="planes-titulo"
      className="mx-auto max-w-[1240px] px-5 sm:px-8"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[1fr_minmax(0,38ch)] lg:items-end">
        <h2 id="planes-titulo" className="display landing-reveal text-[clamp(3rem,7vw,5.5rem)]">Cuatro planes</h2>
        <p className="leading-relaxed text-fog">
          Cada plan es una cantidad de energía para 3 meses, que se paga mes a
          mes. Entre más grande el plan, menos pagas por cada{" "}
          <span className="whitespace-nowrap">kWh</span>. Toda la energía se
          vende a {loaded ? formatCop(catalog.saleCopPerKwh) : "…"} el kWh.
        </p>
      </div>
      {!loaded ? (
        <div className="mt-10">
          {error ? (
            <>
              <ErrorNote>No pudimos cargar los precios vigentes.</ErrorNote>
              <button
                type="button"
                onClick={() => void reload()}
                className="btn btn-ghost mt-5"
              >
                Volver a cargar
              </button>
            </>
          ) : (
            <div
              className="skeleton h-80"
              aria-busy="true"
              aria-label="Cargando precios vigentes"
            />
          )}
        </div>
      ) : (
        <>
          <ul className="mt-9 grid gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:mt-12 lg:grid-cols-4" aria-label="Planes de energía">
            {catalog.plans.map((plan) => (
              <li key={plan.id} className="landing-plan-card landing-reveal flex min-w-0 flex-col border border-line-strong p-4 sm:p-5 xl:p-6">
                <h3 className="display text-[2.5rem]">{plan.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fog">
                  <span className="num font-medium">{formatNumber(plan.totalKwh)} kWh</span> en {plan.months} meses
                </p>
                <dl className="mt-6 space-y-4 border-t border-line pt-4">
                  <div>
                    <dt className="cap">Pago mensual</dt>
                    <dd className="num mt-1.5 break-words text-[clamp(1rem,2vw,1.4rem)]">{formatCop(plan.monthlyCop)}</dd>
                  </div>
                  <div>
                    <dt className="cap">Utilidad bruta de referencia</dt>
                    <dd className="num landing-plan-margin mt-1.5 text-[1.35rem]">{formatPct(plan.profitPct, 2)}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-5">
                  {plan.available ? (
                    <Link href={planCheckoutHref(plan.id)} aria-label={`Elegir ${plan.name}`} className="btn btn-ghost landing-plan-action w-full justify-between px-3.5">
                      Elegir
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className="flex min-h-11 items-center border-t border-line text-sm text-mute">Sin cupo por ahora</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <details className="landing-plan-comparison group mt-5 border border-line-strong">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium sm:px-6 [&::-webkit-details-marker]:hidden">
              Comparar todos los planes
              <ChevronDown aria-hidden="true" size={18} className="shrink-0 motion-safe:transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-line p-4 sm:px-6">
              <p className="mb-4 text-xs text-mute lg:hidden">Desliza la tabla hacia los lados para ver todas las columnas.</p>
              <PlansTable catalog={catalog} layout="table" />
            </div>
          </details>
          <ProfitPreview plans={catalog.plans} className="landing-profit border-x border-b border-line-strong px-4 pb-5 sm:px-6 sm:pb-6" />
        </>
      )}
      <p className="mt-6 max-w-[72ch] text-sm leading-relaxed text-mute">
        La utilidad es la diferencia entre el precio de venta y el precio del
        plan, sobre el precio del plan. Cada pago mensual activa 30 días de
        energía; si un mes no se paga, la energía se pausa hasta el siguiente
        pago. Los porcentajes con ≈ de la tabla están redondeados al entero más cercano.
      </p>
    </section>
  );
}
