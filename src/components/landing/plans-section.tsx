"use client";
import Link from "next/link";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatCop } from "@/lib/format";
import { PlansTable } from "@/components/plans/plans-table";

/** Los planes, con sus precios vigentes. Para comprar hay que ingresar. */
export function PlansSection() {
  const { catalog } = useCatalog();
  return (
    <section id="planes" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,38ch)] lg:items-end">
        <h2 className="display text-[clamp(3rem,7vw,5.5rem)]">Cuatro planes</h2>
        <p className="leading-relaxed text-fog">
          Cada plan es una cantidad de energía para 3 meses, que se paga mes a mes. Entre más grande el plan, menos pagas por cada <span className="whitespace-nowrap">kWh</span>. Toda la energía se
          vende a {formatCop(catalog.saleCopPerKwh)} el kWh.
        </p>
      </div>
      <div className="mt-10 lg:mt-12">
        <PlansTable
          catalog={catalog}
          action={(p) =>
            p.available ? (
              <Link href={`/ingresar?plan=${p.id}`} className="btn btn-ghost w-full lg:w-auto">
                Elegir
              </Link>
            ) : null
          }
        />
      </div>
      <p className="mt-6 max-w-[72ch] text-sm leading-relaxed text-mute">
        La utilidad es la diferencia entre el precio de venta y el precio del plan, sobre el precio del plan. Cada pago mensual activa 30 días de energía; si un mes no se paga, la energía se pausa
        hasta el siguiente pago.
      </p>
    </section>
  );
}
