"use client";
import Link from "next/link";
import { useCatalog } from "@/lib/client/use-catalog";
import { planCheckoutHref } from "@/lib/navigation";
import { ErrorNote } from "@/components/ui/field";
import { formatCop } from "@/lib/format";
import { PlansTable } from "@/components/plans/plans-table";
import { ProfitPreview } from "@/components/plans/profit-preview";

/** Los planes, con sus precios vigentes. Para comprar hay que ingresar. */
export function PlansSection() {
  const { catalog, loaded, error, reload } = useCatalog();
  return (
    <section
      id="planes"
      className="mx-auto max-w-[1240px] scroll-mt-24 px-5 sm:px-8"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[1fr_minmax(0,38ch)] lg:items-end">
        <h2 className="display landing-reveal text-[clamp(3rem,7vw,5.5rem)]">Cuatro planes</h2>
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
          <div className="landing-plan-list mt-10 lg:mt-12">
            <PlansTable
              catalog={catalog}
              action={(p) =>
                p.available ? (
                  <Link
                    href={planCheckoutHref(p.id)}
                    className="btn btn-ghost w-full lg:w-auto"
                  >
                    Elegir
                  </Link>
                ) : null
              }
            />
          </div>
          <ProfitPreview plans={catalog.plans} />
        </>
      )}
      <p className="mt-6 max-w-[72ch] text-sm leading-relaxed text-mute">
        La utilidad es la diferencia entre el precio de venta y el precio del
        plan, sobre el precio del plan. Cada pago mensual activa 30 días de
        energía; si un mes no se paga, la energía se pausa hasta el siguiente
        pago. Los porcentajes con ≈ están redondeados al entero más cercano; el
        detalle muestra dos decimales.
      </p>
    </section>
  );
}
