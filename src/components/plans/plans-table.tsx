"use client";
import type { CatalogDTO } from "@/lib/client/use-catalog";
import { formatCop, formatNumber } from "@/lib/format";

type Plan = CatalogDTO["plans"][number];

const pctLabel = (fraction: number) =>
  `${Math.abs(fraction * 100 - Math.round(fraction * 100)) > 1e-6 ? "≈ " : ""}${formatNumber(Math.round(fraction * 100))} %`;

const priceLabel = (label: string) =>
  label.endsWith("kWh") ? (
    <>
      {label.slice(0, -3)}
      <span className="unit">kWh</span>
    </>
  ) : (
    label
  );

/**
 * La tabla de planes: cuánta energía, a qué precio se compra, a cuánto se vende y qué utilidad deja.
 * `action` dibuja lo que va al final de cada plan (un enlace en el inicio, un botón en el panel).
 */
export function PlansTable({
  catalog,
  action,
  selectedId,
}: {
  catalog: CatalogDTO;
  action?: (plan: Plan) => React.ReactNode;
  selectedId?: string | null;
}) {
  return (
    <>
      {/* Escritorio: una tabla */}
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Planes de energía de 3 meses, con pago mensual
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              {[
                "Plan",
                "Energía en 3 meses",
                "Cada día",
                "Compra / kWh",
                "Venta / kWh",
                "Utilidad bruta",
                "Pago mensual",
              ].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`cap pb-3 font-medium ${i === 0 ? "" : "text-right"} ${i === 6 ? "pr-6" : ""}`}
                >
                  {priceLabel(h)}
                </th>
              ))}
              {action && (
                <th scope="col" className="sr-only">
                  Acción
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {catalog.plans.map((p) => {
              const selected = p.id === selectedId;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-line ${selected ? "bg-ink text-void" : ""} ${p.available ? "" : "text-dim"}`}
                >
                  <th scope="row" className="py-5 pl-0 pr-4 font-normal">
                    <span
                      className={`display block text-[2.5rem] ${selected ? "pl-4" : ""}`}
                    >
                      {p.name}
                    </span>
                    {!p.available && (
                      <span className="cap mt-1 block text-dim">
                        Sin cupo por ahora
                      </span>
                    )}
                  </th>
                  <td className="num py-5 text-right text-[1.05rem]">
                    {formatNumber(p.totalKwh)} kWh
                  </td>
                  <td className="num py-5 text-right text-[1.05rem]">
                    {formatNumber(p.dailyKwh)} kWh
                  </td>
                  <td className="num py-5 text-right text-[1.05rem]">
                    {formatCop(p.priceCopPerKwh)}
                  </td>
                  <td className="num py-5 text-right text-[1.05rem]">
                    {formatCop(p.saleCopPerKwh)}
                  </td>
                  <td className="py-5 text-right">
                    <span className="figure text-[2.5rem]">
                      {pctLabel(p.profitPct)}
                    </span>
                  </td>
                  <td className="num py-5 pr-6 text-right text-[1.05rem]">
                    {formatCop(p.monthlyCop)}
                  </td>
                  {action && (
                    <td className={`py-5 text-right ${selected ? "pr-4" : ""}`}>
                      {action(p)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular y tableta: un bloque por plan */}
      <ul className="lg:hidden">
        {catalog.plans.map((p) => {
          const selected = p.id === selectedId;
          return (
            <li
              key={p.id}
              className={`border-t border-line-strong py-6 ${selected ? "-mx-4 bg-ink px-4 text-void" : ""} ${p.available ? "" : "text-dim"}`}
            >
              <div className="flex items-end justify-between gap-4">
                <h3 className="display text-[2.75rem]">{p.name}</h3>
                <p className="text-right">
                  <span
                    className={`cap block ${selected ? "text-void/70" : ""}`}
                  >
                    Utilidad bruta
                  </span>
                  <span className="figure text-[2.75rem]">
                    {pctLabel(p.profitPct)}
                  </span>
                </p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Energía en 3 meses", `${formatNumber(p.totalKwh)} kWh`],
                  ["Cada día", `${formatNumber(p.dailyKwh)} kWh`],
                  ["Compra / kWh", formatCop(p.priceCopPerKwh)],
                  ["Venta / kWh", formatCop(p.saleCopPerKwh)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className={`cap ${selected ? "text-void/70" : ""}`}>
                      {priceLabel(k)}
                    </dt>
                    <dd className="num mt-1 text-base">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className={`cap ${selected ? "text-void/70" : ""}`}>
                    Pago mensual
                  </dt>
                  <dd className="num mt-1 text-xl">
                    {formatCop(p.monthlyCop)}
                  </dd>
                </div>
              </dl>
              {!p.available && (
                <p className="cap mt-3 text-dim">Sin cupo por ahora</p>
              )}
              {action && <div className="mt-5">{action(p)}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
