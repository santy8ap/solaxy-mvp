import "server-only";
import { and, eq } from "drizzle-orm";
import { BRAND } from "@/config/brand";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { baseUrl, isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { formatCop } from "@/lib/format";
import { newId, orderCode } from "@/lib/ids";
import {
  ORDER_TTL_MS,
  closeOrder,
  fulfillOrder,
  getOrder,
  markProviderStatus,
  type OrderRow,
} from "@/lib/orders";
import { resolvePlanPayment } from "@/lib/plans/service";
import { requireCompleteProfile } from "@/lib/profile";
import { mercadoPagoConfig } from "./config";
import { isMercadoPagoTest } from "./mercadopago-account";
import { mercadoPagoFor, mercadoPagoLimits } from "./mercadopago-limits";
import { payLog } from "./log";
import { assertExpectedPayment, type ExpectedPayment } from "./plan-target";
import {
  bestPayment,
  buildPreference,
  failureReason,
  mapMpStatus,
  verifyWebhookSignature,
  type MpOutcome,
  type MpPayment,
} from "./mercadopago";

export interface MpDeps {
  fetch?: typeof fetch;
}

/** Pagos hechos con credenciales o cuentas de prueba: no son dinero real. */
export const MP_SANDBOX_NETWORK = "Mercado Pago (pruebas)";

function enabledConfig() {
  const cfg = mercadoPagoConfig();
  if (!cfg.enabled)
    throw new MarketError(
      "El pago con Mercado Pago todavía no está configurado.",
      503,
    );
  return cfg;
}

async function mpRequest<T>(
  path: string,
  deps: MpDeps,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  const cfg = enabledConfig();
  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(`${cfg.apiBase}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${cfg.accessToken}`,
        accept: "application/json",
        ...(init.body !== undefined && { "content-type": "application/json" }),
        ...(init.idempotencyKey && {
          "x-idempotency-key": init.idempotencyKey,
        }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    payLog("api_fallida", {
      proveedor: "mercadopago",
      path,
      error: String(err).slice(0, 200),
    });
    throw new MarketError(
      "No pudimos conectarnos con Mercado Pago. Intenta de nuevo en un momento.",
      502,
    );
  }
  const json = (await res.json().catch(() => null)) as T | null;
  return { status: res.status, ok: res.ok, json };
}

/** Crea la orden pendiente y la preferencia del Checkout Pro; devuelve la URL a la que se redirige al usuario. */
/** `planId` compra el primer mes de un plan nuevo; `subscriptionId` paga el mes siguiente de un plan del usuario. */
export async function createMercadoPagoOrder(
  input: {
    userId: string;
    email: string;
    planId?: string;
    subscriptionId?: string;
  } & ExpectedPayment,
  deps: MpDeps = {},
) {
  const cfg = enabledConfig();
  const profile = await requireCompleteProfile(input.userId);
  // Credenciales de prueba (TEST-… o APP_USR-… de una cuenta de prueba): la orden queda marcada como de prueba.
  const testAccount = await isMercadoPagoTest(deps);
  const now = Date.now();
  const p = await resolvePlanPayment(
    input.userId,
    { planId: input.planId, subscriptionId: input.subscriptionId },
    now,
  );
  assertExpectedPayment(p, input);
  // Mercado Pago tiene un tope por pago: por encima del de las tarjetas solo queda PSE, y por encima del de PSE no se puede.
  const limits = await mercadoPagoLimits(deps);
  const mpFor = mercadoPagoFor(p.amountCop, limits);
  if (!mpFor.available) {
    throw new MarketError(
      `Mercado Pago recibe hasta ${formatCop(limits.pseMaxCop)} por pago y este mes cuesta ${formatCop(p.amountCop)}. Págalo con USDT o BNB, o escríbenos para pagarlo por transferencia bancaria.`,
      409,
    );
  }
  const orderId = orderCode();
  await db.insert(ledgerTx).values({
    id: orderId,
    userId: input.userId,
    kind: "plan_mes",
    status: "pendiente",
    amountCop: p.amountCop,
    asset: "COP",
    walletName: "Mercado Pago",
    network: testAccount ? MP_SANDBOX_NETWORK : "Mercado Pago",
    createdAt: now,
    method: "mercadopago",
    expectedAmount: String(p.amountCop),
    expiresAt: now + ORDER_TTL_MS,
    subscriptionId: p.subscriptionId,
    periodIndex: p.periodIndex,
    kwh: p.kwh,
  });
  const preference = buildPreference({
    orderId,
    title: `${p.planName} · mes ${p.periodIndex} de ${p.months} · ${BRAND.name}`,
    amountCop: p.amountCop,
    baseUrl: baseUrl(),
    payer: { email: input.email, fullName: profile.fullName },
    cards: mpFor.cards,
  });
  const res = await mpRequest<{
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
    message?: string;
  }>("/checkout/preferences", deps, {
    method: "POST",
    body: preference,
    idempotencyKey: orderId,
  }).catch(async (err) => {
    await closeOrder(orderId, "fallida", {
      note: "No se pudo crear el pago en Mercado Pago.",
    });
    throw err;
  });
  // Solo las credenciales antiguas (TEST-) usan el checkout de pruebas; las de una cuenta de prueba usan el normal.
  const checkoutUrl = cfg.sandbox
    ? (res.json?.sandbox_init_point ?? res.json?.init_point)
    : res.json?.init_point;
  if (!res.ok || !checkoutUrl) {
    payLog("preferencia_rechazada", {
      proveedor: "mercadopago",
      orderId,
      httpStatus: res.status,
      mensaje: res.json?.message,
    });
    await closeOrder(orderId, "fallida", {
      note: "Mercado Pago no aceptó la orden.",
    });
    throw new MarketError(
      "Mercado Pago no aceptó la orden. Intenta de nuevo en un momento.",
      502,
    );
  }
  await db
    .update(ledgerTx)
    .set({ message: `preferencia:${res.json?.id ?? ""}` })
    .where(eq(ledgerTx.id, orderId));
  payLog("orden_creada", {
    proveedor: "mercadopago",
    orderId,
    userId: input.userId,
    plan: p.subscriptionId,
    mes: p.periodIndex,
    kwh: p.kwh,
    amountCop: p.amountCop,
    tarjetas: mpFor.cards,
    pruebas: testAccount,
  });
  return {
    orderId,
    checkoutUrl,
    planName: p.planName,
    periodIndex: p.periodIndex,
    amountCop: p.amountCop,
  };
}

/** Un segundo pago aprobado para una orden ya confirmada: el dinero llegó dos veces y hay que devolverlo. */
async function recordDuplicatePayment(order: OrderRow, payment: MpPayment) {
  const [exists] = await db
    .select({ id: ledgerTx.id })
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.method, "mercadopago"),
        eq(ledgerTx.providerId, String(payment.id)),
      ),
    );
  if (exists) return;
  const now = Date.now();
  try {
    await db.insert(ledgerTx).values({
      id: newId("dup-"),
      userId: order.userId,
      kind: order.kind,
      status: "por_reembolsar",
      amountCop: Math.round(payment.transaction_amount ?? 0),
      subscriptionId: order.subscriptionId,
      periodIndex: order.periodIndex,
      asset: "COP",
      walletName: "Mercado Pago",
      network:
        payment.live_mode === false ? MP_SANDBOX_NETWORK : "Mercado Pago",
      note: `Pago duplicado de la orden ${order.id}: hay que devolverlo.`,
      createdAt: now,
      method: "mercadopago",
      providerId: String(payment.id),
      providerStatus: payment.status,
      expectedAmount: order.expectedAmount,
    });
    payLog("pago_duplicado", {
      proveedor: "mercadopago",
      orderId: order.id,
      providerId: String(payment.id),
    });
  } catch {
    /* otra solicitud ya lo registró (índice único) */
  }
}

/** Aplica a la orden lo que dice Mercado Pago de un pago (siempre leído de su API, nunca del cuerpo de un webhook). */
async function applyPayment(order: OrderRow, payment: MpPayment) {
  const outcome = mapMpStatus(payment.status);
  const proof = {
    providerId: String(payment.id),
    providerStatus: payment.status,
  };
  if (payment.live_mode === false && order.network !== MP_SANDBOX_NETWORK) {
    await db
      .update(ledgerTx)
      .set({ network: MP_SANDBOX_NETWORK })
      .where(eq(ledgerTx.id, order.id));
  }
  if (outcome === "aprobada") {
    const amountOk =
      Math.round(payment.transaction_amount ?? -1) === order.amountCop &&
      payment.currency_id === "COP";
    if (payment.live_mode === false && !isDemoMode()) {
      // Con cobros reales, un pago hecho con una cuenta o tarjeta de prueba no es dinero: no activa nada.
      await closeOrder(
        order.id,
        "fallida",
        {
          ...proof,
          note: "Fue un pago de prueba de Mercado Pago: no se cobró dinero y no activa el plan.",
        },
        ["pendiente", "verificando", "fallida"],
      );
    } else if (!amountOk) {
      await closeOrder(
        order.id,
        "por_reembolsar",
        {
          ...proof,
          note: `Mercado Pago aprobó ${payment.transaction_amount} ${payment.currency_id}, que no coincide con la orden. Hay que devolver el pago.`,
        },
        ["pendiente", "verificando", "fallida"],
      );
    } else {
      // Un intento rechazado seguido de uno aprobado: el aprobado manda.
      await fulfillOrder(order.id, proof, { reopen: ["fallida"] });
    }
  } else if (outcome === "fallida") {
    await closeOrder(order.id, "fallida", {
      ...proof,
      note: failureReason(payment),
    });
  } else if (outcome === "devuelta") {
    // Un pago aprobado que luego se devolvió o se desconoció: la orden queda marcada para revisión.
    await db
      .update(ledgerTx)
      .set({ providerStatus: payment.status })
      .where(
        and(
          eq(ledgerTx.id, order.id),
          eq(ledgerTx.providerId, String(payment.id)),
        ),
      );
    await closeOrder(order.id, "fallida", {
      ...proof,
      note: "El pago fue devuelto.",
    });
    payLog("pago_devuelto", {
      proveedor: "mercadopago",
      orderId: order.id,
      providerId: String(payment.id),
      status: payment.status,
    });
  } else {
    await markProviderStatus(order.id, proof);
  }
}

export type MpSyncOutcome = MpOutcome | "sin_pago";

/**
 * Consulta en Mercado Pago los pagos de una orden (por id y por referencia) y aplica el que manda.
 * Se usa al volver del checkout, en cada notificación y desde el admin. Idempotente.
 */
export async function syncMercadoPagoOrder(
  { orderId, paymentId }: { orderId: string; paymentId?: string },
  deps: MpDeps = {},
) {
  const order = await getOrder(orderId);
  if (!order || order.method !== "mercadopago") return null;
  const found = new Map<string, MpPayment>();
  if (paymentId && /^\d+$/.test(paymentId)) {
    const r = await mpRequest<MpPayment>(`/v1/payments/${paymentId}`, deps);
    if (r.ok && r.json?.external_reference === order.id)
      found.set(String(r.json.id), r.json);
  }
  const search = await mpRequest<{ results?: MpPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(order.id)}&sort=date_created&criteria=desc`,
    deps,
  );
  if (!search.ok && found.size === 0)
    throw new MarketError(
      "Mercado Pago no respondió como esperábamos. Intenta de nuevo en un momento.",
      502,
    );
  for (const p of search.json?.results ?? [])
    if (p.external_reference === order.id) found.set(String(p.id), p);

  const payments = [...found.values()];
  const best = bestPayment(payments);
  if (!best) return { order, outcome: "sin_pago" as MpSyncOutcome };
  payLog("pago_consultado", {
    proveedor: "mercadopago",
    orderId: order.id,
    providerId: String(best.id),
    status: best.status,
    metodo: best.payment_type_id,
  });
  await applyPayment(order, best);

  const current = (await getOrder(order.id)) ?? order;
  if (current.status === "confirmada") {
    for (const p of payments)
      if (p.status === "approved" && String(p.id) !== current.providerId)
        await recordDuplicatePayment(current, p);
  }
  return { order: current, outcome: mapMpStatus(best.status) as MpSyncOutcome };
}

/** Notificación (webhook) de Mercado Pago: verifica la firma y consulta el pago en su API. */
export async function handleMercadoPagoNotification(
  req: { body: unknown; query: URLSearchParams; headers: Headers },
  deps: MpDeps = {},
): Promise<{ status: number; message: string }> {
  const cfg = mercadoPagoConfig();
  if (!cfg.enabled)
    return { status: 503, message: "Mercado Pago no está configurado." };
  const body = (req.body ?? {}) as {
    type?: string;
    topic?: string;
    data?: { id?: string | number };
  };
  const type = req.query.get("type") ?? body.type;
  // Los avisos IPN antiguos (?topic=payment&id=…) no vienen firmados: se ignoran (con 200, para que no se reintenten).
  // Los pagos llegan por el webhook firmado y se consultan al volver del checkout.
  if (!type && (req.query.get("topic") ?? body.topic))
    return {
      status: 200,
      message: "Aviso IPN ignorado: se usan los webhooks firmados",
    };
  const dataId =
    req.query.get("data.id") ??
    (body.data?.id != null ? String(body.data.id) : null);
  if (type !== "payment" || !dataId)
    return { status: 200, message: "Evento ignorado" };
  // Con dinero real, solo se atienden notificaciones firmadas: sin la clave secreta no se puede saber quién las manda.
  if (!cfg.webhookSecret && !isDemoMode()) {
    payLog("webhook_rechazado", {
      proveedor: "mercadopago",
      motivo: "sin_clave_secreta",
      dataId,
    });
    return {
      status: 401,
      message:
        "Falta MERCADOPAGO_WEBHOOK_SECRET: con dinero real solo se aceptan notificaciones firmadas.",
    };
  }
  if (
    cfg.webhookSecret &&
    !verifyWebhookSignature({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
      secret: cfg.webhookSecret,
    })
  ) {
    payLog("webhook_rechazado", {
      proveedor: "mercadopago",
      motivo: "firma",
      dataId,
    });
    return { status: 401, message: "Firma inválida" };
  }
  const r = await mpRequest<MpPayment>(
    `/v1/payments/${encodeURIComponent(dataId)}`,
    deps,
  );
  if (r.status === 404) return { status: 200, message: "Pago no encontrado" };
  if (!r.ok || !r.json) throw new MarketError("Mercado Pago no respondió", 502);
  const ref = r.json.external_reference;
  if (!ref) return { status: 200, message: "Pago sin referencia" };
  const result = await syncMercadoPagoOrder(
    { orderId: ref, paymentId: String(r.json.id) },
    deps,
  );
  if (!result)
    payLog("referencia_desconocida", {
      proveedor: "mercadopago",
      reference: ref,
      providerId: String(r.json.id),
    });
  return { status: 200, message: "ok" };
}
