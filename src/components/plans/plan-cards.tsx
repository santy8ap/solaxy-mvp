"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import {
  ENERGY_PLANS,
  planSummary,
  type EnergyPlan,
} from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";

export function PlanCards({
  selected,
  onPreview,
}: {
  selected: EnergyPlan;
  onPreview?(plan: EnergyPlan): void;
}) {
  const index = ENERGY_PLANS.findIndex((plan) => plan.id === selected.id);
  return (
    <div
      className="plan-grid"
      role="group"
      aria-label="Elige un plan para empezar tu compra"
      style={{
        "--selected-plan": index,
        "--selected-column": index % 2,
        "--selected-row": Math.floor(index / 2),
      } as CSSProperties}
    >
      {ENERGY_PLANS.map((plan) => (
        <Link
          href={`/comprar/${plan.id}`}
          prefetch={false}
          className={`plan-card ${selected.id === plan.id ? "selected" : ""}`}
          key={plan.id}
          data-plan-number={plan.id}
          onMouseEnter={() => onPreview?.(plan)}
          onFocus={() => onPreview?.(plan)}
          aria-label={`Comprar plan ${plan.name}: ${formatNumber(plan.daily)} kWh diarios, ${formatCop(planSummary(plan).monthlyCop)} COP al mes`}
        >
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
            <span className="plan-card-footer-copy">
              <span>{formatNumber(planSummary(plan).totalKwh)} kWh / 3 meses</span>
              <span className="plan-card-action">Empezar compra</span>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}
