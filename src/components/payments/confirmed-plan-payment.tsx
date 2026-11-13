import type { TxDTO } from "@/lib/portfolio";
import { DAYS_PER_MONTH } from "@/lib/energy/plan-math";
import { formatNumber } from "@/lib/format";

export function ConfirmedPlanPayment({
  order,
  className,
}: {
  order: Pick<TxDTO, "periodIndex" | "kwh">;
  className?: string;
}) {
  return (
    <p className={className}>
      {order.periodIndex
        ? `Registramos el pago del mes ${order.periodIndex} de tu plan.`
        : "Registramos el pago de tu plan."}{" "}
      {order.kwh != null &&
        `Cubre ${formatNumber(order.kwh)} kWh durante ${DAYS_PER_MONTH} días. `}
      {(order.periodIndex ?? 0) > 1
        ? "Si pagaste por adelantado, el nuevo periodo empieza al terminar el anterior."
        : "Consulta las fechas y la energía generada en tu panel."}
    </p>
  );
}
