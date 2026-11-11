"use client";
import { Check, ArrowUpRight } from "lucide-react";
import {
  ENERGY_PLANS,
  planSummary,
  type EnergyPlan,
} from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";

export function PlanCards({
  selected,
  onSelect,
}: {
  selected: EnergyPlan;
  onSelect(plan: EnergyPlan): void;
}) {
  return (
    <fieldset className="plan-grid">
      <legend className="sr-only">Selecciona un plan de energía</legend>
      {ENERGY_PLANS.map((plan) => (
        <label
          className={`plan-card ${selected.id === plan.id ? "selected" : ""}`}
          key={plan.id}
        >
          <input
            type="radio"
            name="energy-plan"
            value={plan.id}
            checked={selected.id === plan.id}
            onChange={() => onSelect(plan)}
          />
          <span className="plan-top eyebrow">
            {plan.name}
            <span>
              {selected.id === plan.id ? <Check size={16} /> : plan.id}
            </span>
          </span>
          <span className="plan-volume">
            {formatNumber(plan.daily)} <span>kWh</span>
          </span>
          <span className="plan-period">energía diaria de referencia</span>
          <span className="plan-price mono">
            {formatCop(plan.price)} <span>/ kWh</span>
          </span>
          <span className="plan-bottom">
            {formatNumber(planSummary(plan).totalKwh)} kWh / 3 meses
            <ArrowUpRight size={16} />
          </span>
        </label>
      ))}
    </fieldset>
  );
}
