import type { PortfolioDTO } from "@/lib/portfolio";
import { formatCop, formatDate } from "@/lib/format";
import { renewalCheckoutHref } from "@/lib/navigation";
import { DAY_MS } from "@/lib/time";

export interface AccountNotice {
  id: string;
  title: string;
  detail: string;
  at: number;
  href: string;
  action: string;
  priority: boolean;
}

/** Avisos derivados exclusivamente de operaciones y fechas reales de la cuenta. */
export function accountNotices(
  data: PortfolioDTO,
  now: number,
): AccountNotice[] {
  const notices: AccountNotice[] = [];
  for (const sub of data.subscriptions) {
    if (sub.state === "en_revision") {
      notices.push({
        id: `revision:${sub.id}`,
        title: "Tu cuenta necesita conciliación",
        detail: `${sub.planName}: el proveedor reportó una devolución. Revisa el movimiento con soporte; los retiros quedan en revisión.`,
        at: data.asOf,
        href: "/ayuda",
        action: "Consultar ayuda",
        priority: true,
      });
    }
    if (
      !["activa", "en_pausa"].includes(sub.state) ||
      sub.paidMonths >= sub.months ||
      sub.paidUntil - now > 5 * DAY_MS
    )
      continue;
    notices.push({
      id: `mes:${sub.id}:${sub.paidMonths}`,
      title:
        sub.state === "en_pausa"
          ? "Tu paquete está en pausa"
          : "Se acerca tu próxima mensualidad",
      detail: `${sub.planName}: mes ${sub.paidMonths + 1}, ${formatCop(sub.monthlyCop)}. ${sub.state === "en_pausa" ? `Puedes retomarlo hasta el ${formatDate(sub.graceEndsAt ?? sub.paidUntil)}.` : `Paga antes del ${formatDate(sub.paidUntil)} para continuar generando.`}`,
      at: sub.paidUntil - 5 * DAY_MS,
      href: renewalCheckoutHref(sub.id),
      action: "Revisar mensualidad",
      priority: true,
    });
  }
  for (const tx of data.transactions) {
    if (
      tx.kind === "retiro" &&
      ["por_aprobar", "confirmada", "rechazada"].includes(tx.status)
    ) {
      const titles: Record<string, string> = {
        por_aprobar: "Estamos revisando tu retiro",
        confirmada: "Retiro pagado",
        rechazada: "Tu retiro necesita atención",
      };
      notices.push({
        id: `mov:${tx.id}:${tx.status}`,
        title: titles[tx.status],
        detail: `${formatCop(tx.amountCop)}. ${tx.note ?? (tx.status === "por_aprobar" ? "El importe está reservado mientras el equipo revisa la solicitud." : "Consulta el detalle en tus movimientos.")}`,
        at: tx.confirmedAt ?? tx.createdAt,
        href: "/panel/billetera",
        action: "Ver retiro",
        priority: tx.status === "rechazada",
      });
    } else if (
      tx.kind === "plan_mes" &&
      ([
        "confirmada",
        "pendiente",
        "verificando",
        "por_reembolsar",
        "reembolsada",
      ].includes(tx.status) ||
        // Una transferencia que el admin no encontró en el banco: la empresa debe saberlo para volver a pagar.
        (tx.status === "fallida" && tx.method === "transferencia"))
    ) {
      const titles: Record<string, string> = {
        confirmada: "Pago del paquete confirmado",
        pendiente: "Tienes un pago pendiente",
        verificando: "Estamos verificando tu pago",
        por_reembolsar: "Tu pago necesita revisión",
        reembolsada: "Reembolso registrado",
        fallida: "No pudimos confirmar tu transferencia",
      };
      notices.push({
        id: `mov:${tx.id}:${tx.status}`,
        title: titles[tx.status],
        detail: `${formatCop(tx.amountCop)}${tx.periodIndex ? ` · mes ${tx.periodIndex}` : ""}. ${tx.note ?? "Consulta la referencia y el estado de la operación."}`,
        at: tx.confirmedAt ?? tx.createdAt,
        href:
          tx.method === "mercadopago" &&
          ["pendiente", "verificando"].includes(tx.status)
            ? `/pagos/resultado?ref=${encodeURIComponent(tx.id)}`
            : "/panel/billetera",
        action: "Ver movimiento",
        priority: tx.status === "por_reembolsar" || tx.status === "fallida",
      });
    }
  }
  return notices.sort(
    (a, b) => Number(b.priority) - Number(a.priority) || b.at - a.at,
  );
}
