"use client";
import { useId, useState } from "react";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import {
  ENERGY_PLANS,
  planSummary,
  type EnergyPlan,
} from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";

export function PlanComparator({
  onSelect,
}: {
  onSelect?(plan: EnergyPlan): void;
}) {
  const id = useId();
  const [leftId, setLeftId] = useState<string>("01");
  const [rightId, setRightId] = useState<string>("04");
  const left =
    ENERGY_PLANS.find((plan) => plan.id === leftId) ?? ENERGY_PLANS[0];
  const right =
    ENERGY_PLANS.find((plan) => plan.id === rightId) ?? ENERGY_PLANS[3];
  const a = planSummary(left),
    b = planSummary(right);
  const changeLeft = (value: string) => {
    setLeftId(value);
    if (value === rightId) setRightId(leftId);
  };
  const changeRight = (value: string) => {
    setRightId(value);
    if (value === leftId) setLeftId(rightId);
  };
  const difference = b.monthlyCop - a.monthlyCop;
  const rows = [
    [
      "Energía por día",
      `${formatNumber(left.daily)} kWh`,
      `${formatNumber(right.daily)} kWh`,
    ],
    [
      "Energía por mes",
      `${formatNumber(a.monthlyKwh)} kWh`,
      `${formatNumber(b.monthlyKwh)} kWh`,
    ],
    [
      "Energía en 3 meses",
      `${formatNumber(a.totalKwh)} kWh`,
      `${formatNumber(b.totalKwh)} kWh`,
    ],
    ["Precio por kWh", formatCop(left.price), formatCop(right.price)],
    ["Pago mensual", formatCop(a.monthlyCop), formatCop(b.monthlyCop)],
    [
      "Total de los 3 meses",
      formatCop(a.monthlyCop * 3),
      formatCop(b.monthlyCop * 3),
    ],
    [
      "Utilidad bruta de referencia",
      `${formatNumber(a.grossMarginPct, 2)} %`,
      `${formatNumber(b.grossMarginPct, 2)} %`,
    ],
  ];
  return (
    <section className="plan-comparator" aria-labelledby={`${id}-title`}>
      <div className="account-section-heading">
        <div>
          <span className="eyebrow">PON TUS OPCIONES EN PERSPECTIVA</span>
          <h2 id={`${id}-title`}>Dos planes. Una decisión clara.</h2>
        </div>
        <ArrowLeftRight size={20} aria-hidden="true" />
      </div>
      <div className="comparator-pickers">
        <label htmlFor={`${id}-left`}>
          Primer plan
          <select
            id={`${id}-left`}
            value={left.id}
            onChange={(event) => changeLeft(event.target.value)}
          >
            {ENERGY_PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {formatNumber(plan.daily)} kWh/día
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          type="button"
          onClick={() => {
            setLeftId(right.id);
            setRightId(left.id);
          }}
          aria-label="Intercambiar planes"
        >
          <ArrowLeftRight size={18} />
        </button>
        <label htmlFor={`${id}-right`}>
          Segundo plan
          <select
            id={`${id}-right`}
            value={right.id}
            onChange={(event) => changeRight(event.target.value)}
          >
            {ENERGY_PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {formatNumber(plan.daily)} kWh/día
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="comparator-table"
        role="region"
        aria-label="Comparación entre los dos planes seleccionados"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Detalle</th>
              <th scope="col">{left.name}</th>
              <th scope="col">{right.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, v1, v2]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{v1}</td>
                <td>{v2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="comparator-difference" aria-live="polite">
        <span className="eyebrow">LA DIFERENCIA MENSUAL</span>
        <p>
          El plan {right.name} contempla{" "}
          <strong>
            {formatNumber(Math.abs(b.monthlyKwh - a.monthlyKwh))} kWh
          </strong>{" "}
          {b.monthlyKwh >= a.monthlyKwh ? "adicionales" : "menos"} al mes
          {difference === 0
            ? "."
            : ` y un pago ${difference > 0 ? "mayor" : "menor"} en ${formatCop(Math.abs(difference))}.`}
        </p>
        <span>
          Compara también el volumen: un precio por kWh más bajo puede implicar
          un pago mensual mayor.
        </span>
      </div>
      {onSelect && (
        <div className="comparator-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onSelect(left)}
          >
            Elegir {left.name}
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className="btn btn-sun"
            onClick={() => onSelect(right)}
          >
            Elegir {right.name}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <p className="table-note">
        Valores en COP. La utilidad de referencia usa una venta de $400/kWh,
        antes de costos e impuestos, y no garantiza un rendimiento.
      </p>
    </section>
  );
}
