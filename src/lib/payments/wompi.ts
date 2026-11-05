import { createHash, timingSafeEqual } from "node:crypto";

/** Lógica pura de Wompi: firmas, URL del Web Checkout y estados. Sin red ni base de datos. */

export interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string | null;
  status_message?: string | null;
}

export interface WompiEvent {
  event: string;
  data: { transaction: WompiTransaction } & Record<string, unknown>;
  signature?: { properties: string[]; checksum: string };
  timestamp: number;
  environment?: string;
  sent_at?: string;
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Firma de integridad del checkout: SHA256(referencia + montoEnCentavos + moneda + secretoDeIntegridad). */
export function integritySignature({
  reference,
  amountInCents,
  currency = "COP",
  secret,
}: {
  reference: string;
  amountInCents: number;
  currency?: string;
  secret: string;
}) {
  return sha256(`${reference}${amountInCents}${currency}${secret}`);
}

function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function sameHex(a: string, b: string) {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verifica que un evento venga de Wompi: SHA256 de los valores de signature.properties
 * (rutas dentro de data), en orden, más el timestamp, más el secreto de eventos.
 */
export function verifyEventChecksum(event: WompiEvent, secret: string, headerChecksum?: string | null) {
  const props = event?.signature?.properties;
  if (!secret || !Array.isArray(props) || props.length === 0 || typeof event.timestamp !== "number") return false;
  const values = props.map((p) => readPath(event.data, p));
  if (values.some((v) => v === undefined || v === null || typeof v === "object")) return false;
  const expected = sha256(`${values.join("")}${event.timestamp}${secret}`);
  const candidates = [event.signature?.checksum, headerChecksum].filter((c): c is string => typeof c === "string" && c.length > 0);
  return candidates.some((c) => sameHex(c, expected));
}

export interface CheckoutCustomer {
  email: string;
  fullName: string;
  phone: string;
  docType: string;
  docNumber: string;
}

/** URL del Web Checkout de Wompi (redirección), con la firma calculada en el servidor. */
export function buildCheckoutUrl({
  checkoutUrl,
  publicKey,
  reference,
  amountInCents,
  signature,
  redirectUrl,
  customer,
}: {
  checkoutUrl: string;
  publicKey: string;
  reference: string;
  amountInCents: number;
  signature: string;
  redirectUrl: string;
  customer?: CheckoutCustomer;
}) {
  const url = new URL(checkoutUrl);
  const p = url.searchParams;
  p.set("public-key", publicKey);
  p.set("currency", "COP");
  p.set("amount-in-cents", String(amountInCents));
  p.set("reference", reference);
  p.set("signature:integrity", signature);
  p.set("redirect-url", redirectUrl);
  if (customer) {
    p.set("customer-data:email", customer.email);
    p.set("customer-data:full-name", customer.fullName);
    p.set("customer-data:phone-number", customer.phone);
    p.set("customer-data:phone-number-prefix", "+57");
    // El NIT va sin el dígito de verificación.
    p.set("customer-data:legal-id", customer.docNumber.split("-")[0]);
    p.set("customer-data:legal-id-type", customer.docType);
  }
  return url.toString();
}

export type WompiOutcome = "aprobada" | "fallida" | "pendiente";

export function mapWompiStatus(status: string): WompiOutcome {
  if (status === "APPROVED") return "aprobada";
  if (status === "DECLINED" || status === "VOIDED" || status === "ERROR") return "fallida";
  return "pendiente";
}

/** Motivo legible de un pago que no se aprobó. */
export function failureReason(tx: Pick<WompiTransaction, "status" | "status_message">) {
  const base = tx.status === "DECLINED" ? "El pago fue rechazado" : tx.status === "VOIDED" ? "El pago fue anulado" : "Hubo un error con el pago";
  return tx.status_message ? `${base}: ${tx.status_message}` : base;
}
