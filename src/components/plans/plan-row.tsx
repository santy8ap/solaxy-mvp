"use client";
import Link from "next/link";
import { renewalCheckoutHref } from "@/lib/navigation";
import { formatCop, formatDate, formatNumber } from "@/lib/format";
import type { SubscriptionDTO } from "@/lib/portfolio";
import { PLAN_STATE, Status } from "@/components/ui/status";
/** Qué le pasa al plan y qué puede hacer el usuario, en una frase. */
function nextStep(s: SubscriptionDTO) {
  const next = s.paidMonths + 1;
  switch (s.state) {
    case "activa":
      return s.paidMonths < s.months
        ? `Paga el mes ${next} antes del ${formatDate(s.paidUntil)} para que tu energía no se pause.`
        : `Todos los meses están pagados. El plan termina el ${formatDate(s.paidUntil)}.`;
    case "en_pausa":
      return `En pausa desde el ${formatDate(s.paidUntil)}. Paga el mes ${next} antes del ${formatDate(s.graceEndsAt ?? s.paidUntil)} o el plan se cierra.`;
    case "completada":
      return `Terminó el ${formatDate(s.paidUntil)}.`;
    default:
      return "Este plan se cerró. Para seguir generando energía, compra un plan nuevo.";
  }
}

/** Un plan del usuario: estado, meses pagados, energía generada y el pago del mes siguiente. */
export function PlanRow({
  sub,
  now,
}: {
  sub: SubscriptionDTO;
  now: number | null;
}) {
  const state = PLAN_STATE[sub.state] ?? PLAN_STATE.borrador;
  const canPay =
    (sub.state === "activa" || sub.state === "en_pausa") &&
    sub.paidMonths < sub.months;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-5 border-b border-line py-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h3 className="display text-[2.5rem]">{sub.planName}</h3>
          <Status tone={state.tone}>{state.label}</Status>
        </div>
        <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-fog">
          {nextStep(sub)}
        </p>
      </div>

      <div>
        {/* Un tramo por mes: lleno lo ya generado, vacío lo que falta, punteado lo que no se ha pagado. */}
        <div
          className="flex gap-1.5"
          role="img"
          aria-label={`${sub.paidMonths} de ${sub.months} meses pagados`}
        >
          {Array.from({ length: sub.months }, (_, i) => {
            const p = sub.periods.find((x) => x.index === i + 1);
            const done =
              !p || now == null
                ? 0
                : Math.min(
                    1,
                    Math.max(0, (now - p.startsAt) / (p.endsAt - p.startsAt)),
                  );
            return (
              <span
                key={i}
                className={`relative h-2 flex-1 border ${p ? "border-ink" : "border-dashed border-line-strong"}`}
              >
                {p && (
                  <span
                    className="absolute inset-y-0 left-0 bg-ink"
                    style={{ width: `${done * 100}%` }}
                  />
                )}
              </span>
            );
          })}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="cap">Meses pagados</dt>
            <dd className="num mt-1">
              {sub.paidMonths} de {sub.months}
            </dd>
          </div>
          <div>
            <dt className="cap">Cada día</dt>
            <dd className="num mt-1">{formatNumber(sub.dailyKwh)} kWh</dd>
          </div>
          <div>
            <dt className="cap">Precio por kWh</dt>
            <dd className="num mt-1">{formatCop(sub.priceCopPerKwh)}</dd>
          </div>
        </dl>
      </div>

      {canPay && (
        <Link
          href={renewalCheckoutHref(sub.id)}
          className={`btn ${sub.state === "en_pausa" ? "btn-solid" : "btn-ghost"} lg:justify-self-end`}
        >
          Pagar el mes {sub.paidMonths + 1}
        </Link>
      )}
    </li>
  );
}
