"use client";
import { useState } from "react";
import { ArrowUpRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { ENERGY_PLANS, planSummary, type EnergyPlan } from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
import { useSavedPlans } from "@/lib/client/use-saved-plans";
import { toast } from "@/components/ui/toast";
import { PlanCards } from "./plan-cards";
import { PlanComparator } from "./plan-comparator";

export function PlanCatalog({
  initialPlanId = "04",
  headingLevel = 2,
}: {
  initialPlanId?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const [selected, setSelected] = useState<EnergyPlan>(
    () =>
      ENERGY_PLANS.find((plan) => plan.id === initialPlanId) ?? ENERGY_PLANS[3],
  );
  const saved = useSavedPlans();
  const summary = planSummary(selected);
  return (
    <div className="plan-catalog">
      <div className="panel-page-heading catalog-heading">
        <div>
          <span className="eyebrow">IN WORLD ENERGY / PLANES PARA EMPRESAS</span>
          <Heading>
            ELIGE TU
            <br />
            PLAN DE ENERGÍA.
          </Heading>
        </div>
        <p>
          Contrato de 3 meses.
          <br />
          Pago mensual en pesos colombianos.
          <br />
          <span className="muted">Pulsa un plan para continuar con tu compra.</span>
        </p>
      </div>
      <PlanCards selected={selected} onPreview={setSelected} />
      <section
        className="catalog-summary"
        aria-label="Resumen del plan seleccionado"
      >
        <div>
          <span className="eyebrow">
            VISTA PREVIA / PLAN {selected.name.toUpperCase()}
          </span>
          <p className="catalog-price" key={selected.id}>
            {formatCop(summary.monthlyCop)} <span>COP</span>
          </p>
          <p>
            {formatNumber(summary.monthlyKwh)} kWh al mes ·{" "}
            {formatNumber(summary.totalKwh)} kWh en total
          </p>
        </div>
        <Link href={`/comprar/${selected.id}`} prefetch={false} className="btn btn-sun">
          Comprar plan {selected.name} <ArrowUpRight size={16} />
        </Link>
      </section>
      <div className="catalog-facts">
        <div>
          <span>Precio por kWh</span>
          <strong>{formatCop(selected.price)}</strong>
        </div>
        <div>
          <span>Venta de referencia / kWh</span>
          <strong>$ 400</strong>
        </div>
        <div>
          <span>Utilidad bruta de referencia</span>
          <strong>{formatNumber(summary.grossMarginPct, 2)} %</strong>
        </div>
      </div>
      <p className="table-note">
        La utilidad bruta se calcula sobre el precio de compra, antes de costos
        e impuestos. Los valores son de referencia y no garantizan un
        rendimiento. Puedes revisar tu selección; la contratación mensual
        todavía no está habilitada.
      </p>
      <div className="catalog-links">
        <Link href="/#comparar" className="text-link">
          Comparar los cuatro planes <ArrowUpRight size={14} />
        </Link>
        <Link href="/terminos" className="text-link">
          Consultar términos <ArrowUpRight size={14} />
        </Link>
      </div>
      {saved.plans.length > 0 && (
        <section className="saved-plans" aria-labelledby="saved-plans-title">
          <span className="eyebrow">GUARDADAS EN ESTE NAVEGADOR</span>
          <h2 id="saved-plans-title">Tus selecciones, a mano.</h2>
          <p>
            Guardar una selección no activa un contrato. No se conservan datos
            de empresa.
          </p>
          <ul>
            {saved.plans.map((item) => {
              const plan = ENERGY_PLANS.find(
                (option) => option.id === item.planId,
              );
              if (!plan) return null;
              return (
                <li key={item.planId}>
                  <div>
                    <strong>Plan {plan.name}</strong>
                    <span>
                      {formatNumber(plan.daily)} kWh/día ·{" "}
                      {formatCop(planSummary(plan).monthlyCop)} COP/mes
                    </span>
                  </div>
                  <Link
                    href={`/comprar/${plan.id}`}
                    prefetch={false}
                    className="btn btn-ghost"
                  >
                    Continuar compra <ArrowUpRight size={14} />
                  </Link>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Eliminar selección del plan ${plan.name}`}
                    onClick={() => {
                      saved.remove(item.planId);
                      toast("Selección eliminada.");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <PlanComparator />
    </div>
  );
}
