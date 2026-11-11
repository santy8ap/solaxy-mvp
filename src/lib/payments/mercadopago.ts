import { createHmac, timingSafeEqual } from "node:crypto";

/** Lógica pura de Mercado Pago (Checkout Pro): preferencia, firma de notificaciones y estados. Sin red. */

export interface MpPayment {
  id: number | string;
  status: string;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  live_mode?: boolean | null;
  date_created?: string | null;
}

export type MpOutcome = "aprobada" | "fallida" | "pendiente" | "devuelta";

export function mapMpStatus(status: string): MpOutcome {
  if (status === "approved") return "aprobada";
  if (status === "rejected" || status === "cancelled") return "fallida";
  if (status === "refunded" || status === "charged_back") return "devuelta";
  // pending, in_process, authorized, in_mediation…
  return "pendiente";
}

const REASONS: Record<string, string> = {
  cc_rejected_insufficient_amount: "la tarjeta no tiene fondos suficientes",
  cc_rejected_bad_filled_security_code: "el código de seguridad no es correcto",
  cc_rejected_bad_filled_date: "la fecha de vencimiento no es correcta",
  cc_rejected_bad_filled_other: "algún dato de la tarjeta no es correcto",
  cc_rejected_call_for_authorize: "tu banco pide que autorices el pago (llámalo y vuelve a intentar)",
  cc_rejected_card_disabled: "la tarjeta está desactivada",
  cc_rejected_duplicated_payment: "ya hiciste un pago igual hace poco",
  cc_rejected_high_risk: "el pago fue rechazado por seguridad",
  cc_rejected_max_attempts: "se superó el número de intentos",
  cc_rejected_blacklist: "el pago no se pudo procesar",
  cc_rejected_other_reason: "el banco no aprobó el pago",
  rejected_by_bank: "el banco rechazó el pago",
  rejected_insufficient_data: "faltaron datos para procesar el pago",
  expired: "el pago venció sin completarse",
  by_collector: "el pago fue cancelado",
  by_payer: "cancelaste el pago",
};

/** Motivo legible de un pago que no se aprobó. */
export function failureReason(p: Pick<MpPayment, "status" | "status_detail">) {
  const base = p.status === "cancelled" ? "El pago fue cancelado" : "El pago fue rechazado";
  const detail = p.status_detail ? REASONS[p.status_detail] : undefined;
  return detail ? `${base}: ${detail}.` : `${base}. No se hizo ningún cobro.`;
}

function sameHex(a: string, b: string) {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verifica el encabezado x-signature ("ts=…,v1=…") de una notificación: HMAC-SHA256, con la clave
 * secreta del webhook, del manifiesto "id:[data.id];request-id:[x-request-id];ts:[ts];".
 * Las partes que no vienen en la notificación se omiten; los id alfanuméricos van en minúsculas.
 */
export function verifyWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
  secret: string;
}) {
  if (!secret || !xSignature) return false;
  const parts = Object.fromEntries(
    xSignature.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return sameHex(v1, expected);
}

/** Preferencia del Checkout Pro: el monto exacto de la orden, en pesos, con la orden como referencia. */
export function buildPreference({
  orderId,
  title,
  amountCop,
  baseUrl,
  payer,
}: {
  orderId: string;
  title: string;
  amountCop: number;
  baseUrl: string;
  payer?: { email: string; fullName: string };
}) {
  const back = `${baseUrl}/pagos/resultado?ref=${encodeURIComponent(orderId)}`;
  const [name, ...rest] = (payer?.fullName ?? "").trim().split(/\s+/);
  return {
    items: [{ id: "plan-energia", title, quantity: 1, currency_id: "COP", unit_price: Math.round(amountCop) }],
    ...(payer && { payer: { email: payer.email, name: name ?? "", surname: rest.join(" ") } }),
    external_reference: orderId,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: "approved" as const,
    // Sin notification_url: los avisos llegan por el webhook configurado en Tus integraciones, que viene firmado
    // con la clave secreta. En local, Mercado Pago no puede avisar: el pago se confirma al volver del checkout.
    statement_descriptor: "IN WORLD ENERGY",
    // Tarjetas, PSE (Nequi y Daviplata aparecen dentro de PSE) y saldo de Mercado Pago. Sin efectivo.
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
  };
}

export type MpPreference = ReturnType<typeof buildPreference>;

/** De varios intentos de pago de una misma orden, el que manda: aprobado, luego en proceso, luego el último. */
export function bestPayment(payments: MpPayment[]) {
  const byDate = [...payments].sort((a, b) => String(b.date_created ?? "").localeCompare(String(a.date_created ?? "")));
  return (
    byDate.find((p) => p.status === "approved") ??
    byDate.find((p) => mapMpStatus(p.status) === "pendiente") ??
    byDate.find((p) => mapMpStatus(p.status) === "devuelta") ??
    byDate[0] ??
    null
  );
}
