import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { MpPayment } from "@/lib/payments/mercadopago";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-mp-")), "test.db")}`;
const TOKEN = "APP_USR-token-de-prueba";
const SECRET = "mp_secret_de_prueba";
vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", TOKEN);
vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
vi.stubEnv("MERCADOPAGO_API_BASE", "https://mp.falso");

let svc: typeof import("@/lib/payments/mercadopago-service");
let profile: typeof import("@/lib/profile");
let market: typeof import("@/lib/market");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

/** Mercado Pago falso: preferencias, pagos y búsqueda por referencia. */
const mp = {
  preferences: [] as { body: Record<string, unknown> }[],
  payments: new Map<string, MpPayment>(),
};
let seq = 1000;
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const auth = new Headers(init?.headers).get("authorization");
  if (auth !== `Bearer ${TOKEN}`) return new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 });
  if (url.pathname === "/checkout/preferences" && init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    mp.preferences.push({ body });
    const id = `pref-${mp.preferences.length}`;
    return new Response(JSON.stringify({ id, init_point: `https://mp.falso/checkout?pref=${id}`, sandbox_init_point: `https://mp.falso/sandbox?pref=${id}` }), { status: 201 });
  }
  if (url.pathname === "/v1/payments/search") {
    const ref = url.searchParams.get("external_reference");
    return new Response(JSON.stringify({ results: [...mp.payments.values()].filter((p) => p.external_reference === ref) }));
  }
  const m = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
  if (m) {
    const p = mp.payments.get(m[1]);
    return new Response(JSON.stringify(p ?? { message: "not_found" }), { status: p ? 200 : 404 });
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;
const deps = { fetch: fakeFetch };

function pay(reference: string, amount: number, status: string, extra: Partial<MpPayment> = {}) {
  const p: MpPayment = {
    id: ++seq,
    status,
    status_detail: status === "approved" ? "accredited" : null,
    external_reference: reference,
    transaction_amount: amount,
    currency_id: "COP",
    payment_type_id: "credit_card",
    live_mode: true,
    date_created: new Date(Date.now() + seq).toISOString(),
    ...extra,
  };
  mp.payments.set(String(p.id), p);
  return p;
}

/** Notificación firmada como la manda Mercado Pago. */
function notification(paymentId: number | string, secret = SECRET) {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = `req-${paymentId}`;
  const v1 = createHmac("sha256", secret).update(`id:${paymentId};request-id:${requestId};ts:${ts};`).digest("hex");
  return {
    body: { action: "payment.updated", type: "payment", data: { id: String(paymentId) } },
    query: new URLSearchParams({ "data.id": String(paymentId), type: "payment" }),
    headers: new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId }),
  };
}

const PROFILE = { fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true };

async function entriesOf(orderId: string) {
  return dbMod.db.select().from(schema.positionEntry).where(drizzle.eq(schema.positionEntry.txId, orderId));
}
async function orderRow(orderId: string) {
  const [row] = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.id, orderId));
  return row;
}

beforeAll(async () => {
  svc = await import("@/lib/payments/mercadopago-service");
  profile = await import("@/lib/profile");
  market = await import("@/lib/market");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
  for (let i = 30; i <= 40; i++) await profile.saveProfile(`inv-0${i}`, PROFILE);
}, 120_000);

describe("orden con Mercado Pago", () => {
  it("sin datos de inversionista no se puede pagar", async () => {
    await expect(svc.createMercadoPagoOrder({ userId: "inv-050", email: "x@y.co", kw: 1 }, deps)).rejects.toMatchObject({ status: 412 });
  });

  it("crea la orden pendiente y una preferencia con el monto exacto y la orden como referencia", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-030", email: "laura@correo.co", kw: 1.5 }, deps);
    const row = await orderRow(o.orderId);
    expect(row).toMatchObject({ status: "pendiente", method: "mercadopago", kind: "compra", kw: 1.5, expectedAmount: String(row.amountCop) });
    const pref = mp.preferences.at(-1)!.body as { external_reference: string; items: { unit_price: number; currency_id: string }[]; back_urls: { success: string } };
    expect(pref.external_reference).toBe(o.orderId);
    expect(pref.items[0]).toMatchObject({ unit_price: row.amountCop, currency_id: "COP" });
    expect(pref.back_urls.success).toMatch(new RegExp(`/pagos/resultado\\?ref=${o.orderId}$`));
    expect(o.checkoutUrl).toMatch(/^https:\/\/mp\.falso\/checkout\?pref=/);
  });

  it("con credenciales de prueba (TEST-) usa el checkout de pruebas", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-token");
    const testFetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      fakeFetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), authorization: `Bearer ${TOKEN}` } })) as typeof fetch;
    const o = await svc.createMercadoPagoOrder({ userId: "inv-031", email: "a@b.co", kw: 0.5 }, { fetch: testFetch });
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", TOKEN);
    expect(o.checkoutUrl).toMatch(/^https:\/\/mp\.falso\/sandbox\?pref=/);
    expect((await orderRow(o.orderId)).network).toBe(svc.MP_SANDBOX_NETWORK);
  });

  it("con las credenciales de prueba nuevas (APP_USR- de una cuenta de prueba) usa el checkout normal y marca la orden como de prueba", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    const testUserFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input)).pathname === "/users/me") return new Response(JSON.stringify({ site_id: "MCO", tags: ["test_user", "normal"] }));
      return fakeFetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), authorization: `Bearer ${TOKEN}` } });
    }) as typeof fetch;
    const o = await svc.createMercadoPagoOrder({ userId: "inv-031", email: "a@b.co", kw: 0.5 }, { fetch: testUserFetch });
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", TOKEN);
    expect(o.checkoutUrl).toMatch(/^https:\/\/mp\.falso\/checkout\?pref=/);
    expect((await orderRow(o.orderId)).network).toBe(svc.MP_SANDBOX_NETWORK);
  });

  it("con credenciales de producción de una cuenta real, la orden no queda como de prueba", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-032", email: "a@b.co", kw: 0.5 }, deps);
    expect((await orderRow(o.orderId)).network).toBe("Mercado Pago");
  });
});

describe("confirmación del pago", () => {
  it("aprobado: asigna los kW una sola vez, aunque lleguen el webhook y la consulta a la vez", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-032", email: "a@b.co", kw: 1 }, deps);
    const p = pay(o.orderId, (await orderRow(o.orderId)).amountCop, "approved");
    await Promise.all([
      svc.syncMercadoPagoOrder({ orderId: o.orderId, paymentId: String(p.id) }, deps),
      svc.handleMercadoPagoNotification(notification(p.id), deps),
      svc.handleMercadoPagoNotification(notification(p.id), deps),
      svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps),
    ]);
    expect(await entriesOf(o.orderId)).toHaveLength(1);
    expect(await orderRow(o.orderId)).toMatchObject({ status: "confirmada", providerId: String(p.id), providerStatus: "approved" });
  });

  it("rechazado: la orden queda fallida con el motivo", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-033", email: "a@b.co", kw: 0.5 }, deps);
    pay(o.orderId, (await orderRow(o.orderId)).amountCop, "rejected", { status_detail: "cc_rejected_insufficient_amount" });
    const r = await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps);
    expect(r?.order.status).toBe("fallida");
    expect(r?.order.note).toMatch(/fondos/i);
    expect(await entriesOf(o.orderId)).toHaveLength(0);
  });

  it("PSE en proceso: queda pendiente y luego se aprueba por webhook", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-034", email: "a@b.co", kw: 0.5 }, deps);
    const p = pay(o.orderId, (await orderRow(o.orderId)).amountCop, "in_process", { payment_type_id: "bank_transfer", payment_method_id: "pse" });
    expect((await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps))?.order.status).toBe("pendiente");
    expect((await orderRow(o.orderId)).providerStatus).toBe("in_process");
    p.status = "approved";
    expect((await svc.handleMercadoPagoNotification(notification(p.id), deps)).status).toBe(200);
    expect((await orderRow(o.orderId)).status).toBe("confirmada");
    expect(await entriesOf(o.orderId)).toHaveLength(1);
  });

  it("un intento rechazado y luego uno aprobado: manda el aprobado", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-035", email: "a@b.co", kw: 0.5 }, deps);
    const amount = (await orderRow(o.orderId)).amountCop;
    const rejected = pay(o.orderId, amount, "rejected", { status_detail: "cc_rejected_other_reason" });
    await svc.handleMercadoPagoNotification(notification(rejected.id), deps);
    expect((await orderRow(o.orderId)).status).toBe("fallida");
    const approved = pay(o.orderId, amount, "approved");
    await svc.handleMercadoPagoNotification(notification(approved.id), deps);
    expect((await orderRow(o.orderId)).status).toBe("confirmada");
    expect(await entriesOf(o.orderId)).toHaveLength(1);
  });

  it("si el monto aprobado no coincide con la orden, no asigna kW y queda por reembolsar", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-036", email: "a@b.co", kw: 1 }, deps);
    pay(o.orderId, 1000, "approved");
    expect((await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps))?.order.status).toBe("por_reembolsar");
    expect(await entriesOf(o.orderId)).toHaveLength(0);
  });

  it("rechaza una notificación con firma inválida sin tocar la orden", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-037", email: "a@b.co", kw: 1 }, deps);
    const p = pay(o.orderId, (await orderRow(o.orderId)).amountCop, "approved");
    expect((await svc.handleMercadoPagoNotification(notification(p.id, "secreto-equivocado"), deps)).status).toBe(401);
    expect((await orderRow(o.orderId)).status).toBe("pendiente");
  });

  it("un aviso IPN antiguo (topic=payment, sin firma) se responde 200 y se ignora sin consultar la API", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-037", email: "a@b.co", kw: 0.5 }, deps);
    const p = pay(o.orderId, (await orderRow(o.orderId)).amountCop, "approved");
    const calls: string[] = [];
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      return fakeFetch(input, init);
    }) as typeof fetch;
    const ipn = { body: { resource: String(p.id), topic: "payment" }, query: new URLSearchParams({ id: String(p.id), topic: "payment" }), headers: new Headers() };
    expect(await svc.handleMercadoPagoNotification(ipn, { fetch: spy })).toMatchObject({ status: 200 });
    expect(calls).toHaveLength(0);
    expect((await orderRow(o.orderId)).status).toBe("pendiente");
  });

  it("una notificación de webhook sin firma se rechaza (401)", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-037", email: "a@b.co", kw: 0.5 }, deps);
    const p = pay(o.orderId, (await orderRow(o.orderId)).amountCop, "approved");
    const unsigned = { ...notification(p.id), headers: new Headers() };
    expect((await svc.handleMercadoPagoNotification(unsigned, deps)).status).toBe(401);
    expect((await orderRow(o.orderId)).status).toBe("pendiente");
  });

  it("un pago de otra integración (referencia desconocida) no hace nada", async () => {
    const p = pay("OTRA-TIENDA-1", 1000, "approved");
    expect((await svc.handleMercadoPagoNotification(notification(p.id), deps)).status).toBe(200);
    expect(await svc.syncMercadoPagoOrder({ orderId: "SLX-NOEXISTE00" }, deps)).toBeNull();
  });

  it("si un pago aprobado luego se devuelve, la orden queda marcada para revisión", async () => {
    const o = await svc.createMercadoPagoOrder({ userId: "inv-038", email: "a@b.co", kw: 0.5 }, deps);
    const p = pay(o.orderId, (await orderRow(o.orderId)).amountCop, "approved");
    await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps);
    p.status = "refunded";
    await svc.handleMercadoPagoNotification(notification(p.id), deps);
    expect(await orderRow(o.orderId)).toMatchObject({ status: "confirmada", providerStatus: "refunded" });
  });
});

describe("compra P2P con Mercado Pago", () => {
  it("mientras alguien paga una oferta, nadie más puede empezar a pagarla", async () => {
    const l = await market.createListing("inv-001", 0.5, 4_800_000);
    await svc.createMercadoPagoOrder({ userId: "inv-039", email: "a@b.co", listingId: l.id }, deps);
    await expect(svc.createMercadoPagoOrder({ userId: "inv-040", email: "b@c.co", listingId: l.id }, deps)).rejects.toMatchObject({ status: 409 });
  });

  it("si la oferta ya no está cuando llega el pago, queda por reembolsar", async () => {
    const l = await market.createListing("inv-002", 0.5, 4_800_000);
    const o = await svc.createMercadoPagoOrder({ userId: "inv-040", email: "b@c.co", listingId: l.id }, deps);
    await market.cancelListing("inv-002", l.id);
    pay(o.orderId, (await orderRow(o.orderId)).amountCop, "approved");
    expect((await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps))?.order.status).toBe("por_reembolsar");
    expect(await entriesOf(o.orderId)).toHaveLength(0);
  });
});
