"use client";

import { useId, useState } from "react";
import type { CatalogDTO } from "@/lib/client/use-catalog";
import { PriceBreakdown } from "./price-breakdown";

export function ProfitPreview({ plans, initialPlanId }: { plans: CatalogDTO["plans"]; initialPlanId?: string | null }) {
  const id = useId();
  const [selectedId, setSelectedId] = useState(initialPlanId ?? plans[0]?.id ?? "");
  const plan = plans.find((item) => item.id === selectedId) ?? plans[0];
  if (!plan) return null;
  return (
    <section className="mt-12 border-t border-line-strong pt-8" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 id={`${id}-title`} className="text-xl font-medium">Compra, venta y utilidad</h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-mute">Consulta cuánto pagas por la energía, su valor de venta y la diferencia que genera cada plan.</p>
        </div>
        <div className="w-full sm:w-[220px]">
          <label htmlFor={id} className="cap block">Plan</label>
          <select id={id} value={plan.id} onChange={(event) => setSelectedId(event.target.value)} className="field">
            {plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p className="cap mt-6">{plan.name} · contrato de {plan.months} meses</p>
        <PriceBreakdown monthlyKwh={plan.monthlyKwh} months={plan.months} priceCopPerKwh={plan.priceCopPerKwh} saleCopPerKwh={plan.saleCopPerKwh} />
      </div>
    </section>
  );
}
