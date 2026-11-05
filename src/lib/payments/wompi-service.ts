import "server-only";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { baseUrl } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { orderCode } from "@/lib/ids";
import { LISTING_HOLD_MS, closeOrder, fulfillOrder, getOrder, markProviderStatus, resolvePurchase, type OrderRow } from "@/lib/orders";
import { requireCompleteProfile } from "@/lib/profile";
import { wompiConfig } from "./config";
import { payLog } from "./log";
import { buildCheckoutUrl, failureReason, integritySignature, mapWompiStatus, verifyEventChecksum, type WompiEvent, type WompiTransaction, type WompiOutcome } from "./wompi";

/** Crea la orden pendiente y la URL del Web Checkout de Wompi, firmada en el servidor. */
export async function createWompiOrder(input: { userId: string; email: string; kw?: number; listingId?: string }) {
  const cfg = wompiConfig();
  if (!cfg.enabled) throw new MarketError("El pago con tarjeta, PSE o Nequi todavía no está configurado.", 503);
  const profile = await requireCompleteProfile(input.userId);
  const now = Date.now();
  const p = await resolvePurchase(input.userId, { kw: input.kw, listingId: input.listingId }, now);
  const orderId = orderCode();
  const amountInCents = p.amountCop * 100;
  await db.insert(ledgerTx).values({
    id: orderId,
    userId: input.userId,
    kind: p.kind,
    status: "pendiente",
    kw: p.kw,
    amountCop: p.amountCop,
    asset: "COP",
    walletName: "Wompi",
    network: cfg.sandbox ? "Wompi (sandbox)" : "Wompi",
    listingId: p.listingId,
    createdAt: now,
    method: "wompi",
    expectedAmount: String(amountInCents),
    expiresAt: now + LISTING_HOLD_MS,
  });
  const checkoutUrl = buildCheckoutUrl({
    checkoutUrl: cfg.checkoutUrl,
    publicKey: cfg.publicKey,
    reference: orderId,
    amountInCents,
    signature: integritySignature({ reference: orderId, amountInCents, currency: "COP", secret: cfg.integritySecret }),
    redirectUrl: `${baseUrl()}/pagos/resultado`,
    customer: { email: input.email, fullName: profile.fullName, phone: profile.phone, docType: profile.docType, docNumber: profile.docNumber },
  });
  payLog("orden_creada", { proveedor: "wompi", orderId, userId: input.userId, kw: p.kw, amountCop: p.amountCop, sandbox: cfg.sandbox });
  return { orderId, checkoutUrl, kw: p.kw, amountCop: p.amountCop };
}

export interface WompiSyncResult {
  order: OrderRow;
  outcome: WompiOutcome;
}

/** Aplica a la orden lo que dice Wompi de una transacción (ya autenticada: por la API o por un webhook verificado). */
async function applyTransaction(tx: WompiTransaction, source: "consulta" | "webhook"): Promise<WompiSyncResult | null> {
  const order = await getOrder(tx.reference);
  if (!order || order.method !== "wompi") {
    payLog("referencia_desconocida", { proveedor: "wompi", source, reference: tx.reference, providerId: tx.id, status: tx.status });
    return null;
  }
  const outcome = mapWompiStatus(tx.status);
  const proof = { providerId: tx.id, providerStatus: tx.status };
  payLog("transaccion_recibida", { proveedor: "wompi", source, orderId: order.id, providerId: tx.id, status: tx.status, metodo: tx.payment_method_type });

  if (outcome === "aprobada") {
    const amountOk = String(tx.amount_in_cents) === order.expectedAmount && tx.currency === "COP";
    if (!amountOk) {
      await closeOrder(
        order.id,
        "por_reembolsar",
        { ...proof, note: `Wompi aprobó ${tx.amount_in_cents / 100} ${tx.currency}, que no coincide con la orden. Hay que devolver el pago.` },
        ["pendiente", "verificando", "fallida"],
      );
    } else {
      // Un intento rechazado seguido de uno aprobado con la misma referencia: el aprobado manda.
      await fulfillOrder(order.id, proof, { reopen: ["fallida"] });
    }
  } else if (outcome === "fallida") {
    await closeOrder(order.id, "fallida", { ...proof, note: failureReason(tx) });
  } else {
    await markProviderStatus(order.id, proof);
  }
  const current = (await getOrder(order.id)) ?? order;
  return { order: current, outcome };
}

/** Consulta directa a la API de Wompi (al volver del checkout y desde el admin). */
export async function syncWompiTransaction(transactionId: string, deps: { fetch?: typeof fetch } = {}): Promise<WompiSyncResult | null> {
  const cfg = wompiConfig();
  if (!cfg.enabled) throw new MarketError("Wompi no está configurado.", 503);
  const doFetch = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${cfg.apiBase}/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { authorization: `Bearer ${cfg.publicKey}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    payLog("consulta_fallida", { proveedor: "wompi", providerId: transactionId, error: String(err) });
    throw new MarketError("No pudimos consultar el estado del pago en Wompi. Intenta de nuevo en un momento.", 502);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    payLog("consulta_fallida", { proveedor: "wompi", providerId: transactionId, httpStatus: res.status });
    throw new MarketError("Wompi no respondió como esperábamos. Intenta de nuevo en un momento.", 502);
  }
  const body = (await res.json().catch(() => null)) as { data?: WompiTransaction } | null;
  const tx = body?.data;
  if (!tx?.id || !tx.reference || typeof tx.amount_in_cents !== "number") throw new MarketError("Respuesta inesperada de Wompi", 502);
  return applyTransaction(tx, "consulta");
}

function isEvent(body: unknown): body is WompiEvent {
  const b = body as WompiEvent | null;
  return !!b && typeof b.event === "string" && !!b.data && typeof b.data === "object" && typeof b.timestamp === "number";
}

/** Webhook de eventos: verifica el checksum y aplica la transacción. */
export async function handleWompiEvent(body: unknown, headerChecksum?: string | null): Promise<{ status: number; message: string }> {
  const cfg = wompiConfig();
  if (!cfg.webhooksEnabled) return { status: 503, message: "Los eventos de Wompi no están configurados (WOMPI_EVENTS_SECRET)." };
  if (!isEvent(body)) return { status: 400, message: "Evento inválido" };
  if (!verifyEventChecksum(body, cfg.eventsSecret, headerChecksum)) {
    payLog("webhook_rechazado", { proveedor: "wompi", motivo: "checksum", event: body.event });
    return { status: 401, message: "Checksum inválido" };
  }
  if (body.event !== "transaction.updated" || !body.data.transaction?.reference) return { status: 200, message: "Evento ignorado" };
  await applyTransaction(body.data.transaction, "webhook");
  return { status: 200, message: "ok" };
}
