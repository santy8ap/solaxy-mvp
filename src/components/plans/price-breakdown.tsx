import { planEconomics } from "@/lib/energy/plan-math";
import { formatCop, formatNumber } from "@/lib/format";

export interface PriceBreakdownProps {
  monthlyKwh: number;
  months: number;
  priceCopPerKwh: number;
  saleCopPerKwh: number;
}

/** La misma comparación de compra y venta para el catálogo y el mes que se va a pagar. */
export function PriceBreakdown({ monthlyKwh, months, priceCopPerKwh, saleCopPerKwh }: PriceBreakdownProps) {
  const economics = planEconomics({ totalKwh: monthlyKwh * months, priceCopPerKwh }, saleCopPerKwh, months);
  return (
    <section aria-label="Compra, venta y utilidad del paquete" className="mt-7">
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Valor de compra", price: priceCopPerKwh, total: economics.monthlyCop },
          { label: "Valor de venta", price: saleCopPerKwh, total: economics.monthlySaleCop },
        ].map(({ label, price, total }) => (
          <div key={label} className="min-w-0 border border-line-strong p-5">
            <dt className="cap">{label}</dt>
            <dd className="num mt-4 text-[1.8rem] leading-tight">
              {formatCop(price)} <span className="text-xs text-mute">COP / kWh</span>
            </dd>
            <dd className="mt-5 border-t border-line pt-4">
              <span className="cap block">{formatNumber(monthlyKwh)} <span className="unit">kWh</span> al mes</span>
              <span className="num mt-2 block text-xl">{formatCop(total)} <span className="text-xs text-mute">COP / mes</span></span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border border-line-strong p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="cap">Utilidad bruta por <span className="unit">kWh</span></h3>
            <p className="num mt-3 text-[1.8rem] leading-tight">{formatCop(economics.profitPerKwhCop)} <span className="text-xs text-mute">COP / kWh</span></p>
          </div>
          <p className="num text-sm text-fog">{formatNumber(economics.profitPct * 100, 2)} % sobre la compra</p>
        </div>
        <p className="num mt-3 text-xs text-mute">{formatCop(saleCopPerKwh)} − {formatCop(priceCopPerKwh)} = {formatCop(economics.profitPerKwhCop)} por kWh</p>
        <dl className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-3">
          {[
            ["Utilidad diaria", economics.dailyProfitCop],
            ["Utilidad mensual", economics.monthlyProfitCop],
            [`Utilidad en ${months} meses`, economics.totalProfitCop],
          ].map(([label, amount]) => (
            <div key={String(label)} className="min-w-0">
              <dt className="cap">{label}</dt>
              <dd className="num mt-2 break-words text-lg">{formatCop(Number(amount))}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-mute">Valores en COP. Utilidad bruta de referencia, antes de costos e impuestos, calculada con la energía del paquete y sus precios de compra y venta.</p>
    </section>
  );
}
