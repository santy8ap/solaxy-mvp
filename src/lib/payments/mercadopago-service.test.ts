import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MpPayment } from "@/lib/payments/mercadopago";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-mp-")), "test.db")}`;
const TOKEN = "APP_USR-token-de-prueba";
const SECRET = "mp_secret_de_prueba";
vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", TOKEN);
vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
vi.stubEnv("MERCADOPAGO_API_BASE", "https://mp.falso");

let svc: typeof import("@/lib/payments/mercadopago-service");
let plans: typeof import("@/lib/plans/service");
let settings: typeof import("@/lib/settings");
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
  if (auth !== `Bearer ${TOKEN}`)
    return new Response(JSON.stringify({ message: "unauthorized" }), {
      status: 401,
    });
  if (url.pathname === "/checkout/preferences" && init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    mp.preferences.push({ body });
    const id = `pref-${mp.preferences.length}`;
    return new Response(
      JSON.stringify({
        id,
        init_point: `https://mp.falso/checkout?pref=${id}`,
        sandbox_init_point: `https://mp.falso/sandbox?pref=${id}`,
      }),
      { status: 201 },
    );
  }
  if (url.pathname === "/v1/payments/search") {
    const ref = url.searchParams.get("external_reference");
    return new Response(
      JSON.stringify({
        results: [...mp.payments.values()].filter(
          (p) => p.external_reference === ref,
        ),
      }),
    );
  }
  const m = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
  if (m) {
    const p = mp.payments.get(m[1]);
    return new Response(JSON.stringify(p ?? { message: "not_found" }), {
      status: p ? 200 : 404,
    });
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;
const deps = { fetch: fakeFetch };

function pay(
  reference: string,
  amount: number,
  status: string,
  extra: Partial<MpPayment> = {},
) {
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
  const v1 = createHmac("sha256", secret)
    .update(`id:${paymentId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return {
    body: {
      action: "payment.updated",
      type: "payment",
      data: { id: String(paymentId) },
    },
    query: new URLSearchParams({
      "data.id": String(paymentId),
      type: "payment",
    }),
    headers: new Headers({
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    }),
  };
}

/** Pago mensual del Plan 180: 60.000 kWh × $ 348. */
const MONTH_180 = 20_880_000;

async function periodsOf(subscriptionId: string | null) {
  return dbMod.db
    .select()
    .from(schema.planPeriod)
    .where(drizzle.eq(schema.planPeriod.subscriptionId, subscriptionId ?? ""));
}
async function orderRow(orderId: string) {
  const [row] = await dbMod.db
    .select()
    .from(schema.ledgerTx)
    .where(drizzle.eq(schema.ledgerTx.id, orderId));
  return row;
}
const order = (
  userId: string,
  target: { planId?: string; subscriptionId?: string } = { planId: "p180" },
) =>
  svc.createMercadoPagoOrder(
    { userId, email: `${userId}@empresa.co`, ...target },
    deps,
  );

beforeAll(async () => {
  svc = await import("@/lib/payments/mercadopago-service");
  plans = await import("@/lib/plans/service");
  settings = await import("@/lib/settings");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  for (let i = 1; i <= 16; i++) await createUser(`u${i}`);
  await createUser("sin-datos", { profile: false });
}, 120_000);

afterEach(() => {
  vi.stubEnv("DEMO_MODE", "");
});

describe("orden de un mes con Mercado Pago", () => {
  it("sin los datos de la empresa no se puede pagar", async () => {
    await expect(order("sin-datos")).rejects.toMatchObject({ status: 412 });
  });

  it("crea la orden pendiente y una preferencia con el pago mensual exacto y la orden como referencia", async () => {
    const o = await order("u1");
    const row = await orderRow(o.orderId);
    expect(row).toMatchObject({
      status: "pendiente",
      method: "mercadopago",
      kind: "plan_mes",
      amountCop: MONTH_180,
      kwh: 60_000,
      periodIndex: 1,
      expectedAmount: String(MONTH_180),
    });
    expect(row.subscriptionId).toMatch(/^PLN-[0-9A-F]{8}$/);
    const pref = mp.preferences.at(-1)!.body as {
      external_reference: string;
      items: { title: string; unit_price: number; currency_id: string }[];
      back_urls: { success: string };
    };
    expect(pref.external_reference).toBe(o.orderId);
    expect(pref.items[0]).toMatchObject({
      title: "Plan 180 · mes 1 de 3 · X green Energy",
      unit_price: MONTH_180,
      currency_id: "COP",
    });
    expect(pref.back_urls.success).toMatch(
      new RegExp(`/pagos/resultado\\?ref=${o.orderId}$`),
    );
    expect(o.checkoutUrl).toMatch(/^https:\/\/mp\.falso\/checkout\?pref=/);
    // Todavía no se paga: el plan es un borrador que no ocupa cupo ni se muestra.
    expect(await plans.listSubscriptions("u1")).toHaveLength(0);
  });

  it("abandonar el pago y volver a intentarlo reutiliza el mismo borrador", async () => {
    const a = await order("u1");
    const b = await order("u1");
    expect((await orderRow(a.orderId)).subscriptionId).toBe(
      (await orderRow(b.orderId)).subscriptionId,
    );
  });

  it("con credenciales de prueba (TEST-) usa el checkout de pruebas", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-token");
    const testFetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      fakeFetch(input, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string>),
          authorization: `Bearer ${TOKEN}`,
        },
      })) as typeof fetch;
    const o = await svc.createMercadoPagoOrder(
      { userId: "u2", email: "a@b.co", planId: "p180" },
      { fetch: testFetch },
    );
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", TOKEN);
    expect(o.checkoutUrl).toMatch(/^https:\/\/mp\.falso\/sandbox\?pref=/);
    expect((await orderRow(o.orderId)).network).toBe(svc.MP_SANDBOX_NETWORK);
  });

  it("con las credenciales de prueba nuevas (APP_USR- de una cuenta de prueba) usa el checkout normal y marca la orden como de prueba", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    const testUserFetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      if (new URL(String(input)).pathname === "/users/me")
        return new Response(
          JSON.stringify({ site_id: "MCO", tags: ["test_user", "normal"] }),
        );
      return fakeFetch(input, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string>),
          authorization: `Bearer ${TOKEN}`,
        },
      });
    }) as typeof fetch;
    const o = await svc.createMercadoPagoOrder(
      { userId: "u2", email: "a@b.co", planId: "p180" },
      { fetch: testUserFetch },
    );
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", TOKEN);
    expect(o.checkoutUrl).toMatch(/^https:\/\/mp\.falso\/checkout\?pref=/);
    expect((await orderRow(o.orderId)).network).toBe(svc.MP_SANDBOX_NETWORK);
  });

  it("con credenciales de producción de una cuenta real, la orden no queda como de prueba", async () => {
    const o = await order("u3");
    expect((await orderRow(o.orderId)).network).toBe("Mercado Pago");
  });
});

describe("confirmación del pago", () => {
  it("un pago aprobado activa el mes una sola vez, aunque la notificación y la consulta lleguen a la vez", async () => {
    const o = await order("u4");
    const p = pay(o.orderId, MONTH_180, "approved");
    const before = Date.now();
    await Promise.all([
      svc.handleMercadoPagoNotification(notification(p.id), deps),
      svc.handleMercadoPagoNotification(notification(p.id), deps),
      svc.syncMercadoPagoOrder(
        { orderId: o.orderId, paymentId: String(p.id) },
        deps,
      ),
    ]);
    const row = await orderRow(o.orderId);
    expect(row).toMatchObject({
      status: "confirmada",
      providerId: String(p.id),
      providerStatus: "approved",
    });
    const periods = await periodsOf(row.subscriptionId);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      idx: 1,
      kwh: 60_000,
      amountCop: MONTH_180,
      txId: o.orderId,
    });
    expect(periods[0].startsAt).toBeGreaterThanOrEqual(before);
    expect(periods[0].endsAt - periods[0].startsAt).toBe(30 * 86_400_000);
    const [sub] = await plans.listSubscriptions("u4");
    expect(sub).toMatchObject({
      planId: "p180",
      priceCopPerKwh: 348,
      saleCopPerKwh: 400,
      dailyKwh: 2000,
    });
    expect(plans.stateOf(sub, Date.now())).toBe("activa");
  });

  it("un pago rechazado cierra la orden con el motivo y no activa nada", async () => {
    const o = await order("u5");
    pay(o.orderId, MONTH_180, "rejected", {
      status_detail: "cc_rejected_insufficient_amount",
    });
    const r = await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps);
    expect(r?.order).toMatchObject({ status: "fallida" });
    expect(r?.order.note).toMatch(/fondos suficientes/);
    expect(await plans.listSubscriptions("u5")).toHaveLength(0);
  });

  it("un PSE en proceso sigue esperando y se confirma cuando el banco aprueba", async () => {
    const o = await order("u6");
    const p = pay(o.orderId, MONTH_180, "in_process", {
      payment_type_id: "bank_transfer",
    });
    expect(
      (await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps))?.order
        .status,
    ).toBe("pendiente");
    mp.payments.set(String(p.id), { ...p, status: "approved" });
    expect(
      (await svc.handleMercadoPagoNotification(notification(p.id), deps))
        .status,
    ).toBe(200);
    expect((await orderRow(o.orderId)).status).toBe("confirmada");
  });

  it("un intento rechazado seguido de uno aprobado confirma la orden", async () => {
    const o = await order("u7");
    const rejected = pay(o.orderId, MONTH_180, "rejected");
    await svc.handleMercadoPagoNotification(notification(rejected.id), deps);
    expect((await orderRow(o.orderId)).status).toBe("fallida");
    const approved = pay(o.orderId, MONTH_180, "approved");
    await svc.handleMercadoPagoNotification(notification(approved.id), deps);
    expect((await orderRow(o.orderId)).status).toBe("confirmada");
  });

  it("un pago aprobado por otro monto queda por reembolsar y no activa el mes", async () => {
    const o = await order("u8");
    pay(o.orderId, 1000, "approved");
    expect(
      (await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps))?.order
        .status,
    ).toBe("por_reembolsar");
    expect(await plans.listSubscriptions("u8")).toHaveLength(0);
  });

  it("rechaza una notificación con firma inválida o sin firma, sin tocar la orden", async () => {
    const o = await order("u9");
    const p = pay(o.orderId, MONTH_180, "approved");
    expect(
      (
        await svc.handleMercadoPagoNotification(
          notification(p.id, "secreto-equivocado"),
          deps,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await svc.handleMercadoPagoNotification(
          { ...notification(p.id), headers: new Headers() },
          deps,
        )
      ).status,
    ).toBe(401);
    expect((await orderRow(o.orderId)).status).toBe("pendiente");
  });

  it("un aviso IPN antiguo (topic=payment, sin firma) se responde 200 y se ignora sin consultar la API", async () => {
    const o = await order("u9");
    const p = pay(o.orderId, MONTH_180, "approved");
    const calls: string[] = [];
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      return fakeFetch(input, init);
    }) as typeof fetch;
    const ipn = {
      body: { resource: String(p.id), topic: "payment" },
      query: new URLSearchParams({ id: String(p.id), topic: "payment" }),
      headers: new Headers(),
    };
    expect(
      await svc.handleMercadoPagoNotification(ipn, { fetch: spy }),
    ).toMatchObject({ status: 200 });
    expect(calls).toHaveLength(0);
    expect((await orderRow(o.orderId)).status).toBe("pendiente");
  });

  it("un pago de otra integración (referencia desconocida) no hace nada", async () => {
    const p = pay("OTRA-TIENDA-1", 1000, "approved");
    expect(
      (await svc.handleMercadoPagoNotification(notification(p.id), deps))
        .status,
    ).toBe(200);
    expect(
      await svc.syncMercadoPagoOrder({ orderId: "IWE-NOEXISTE00" }, deps),
    ).toBeNull();
  });

  it("si un pago aprobado luego se devuelve, la orden queda marcada para revisión", async () => {
    const o = await order("u10");
    const p = pay(o.orderId, MONTH_180, "approved");
    await svc.handleMercadoPagoNotification(notification(p.id), deps);
    mp.payments.set(String(p.id), { ...p, status: "refunded" });
    await svc.handleMercadoPagoNotification(notification(p.id), deps);
    expect(await orderRow(o.orderId)).toMatchObject({
      status: "reembolsada",
      providerStatus: "refunded",
    });
    const [sub] = await plans.listSubscriptions("u10");
    expect(plans.stateOf(sub)).toBe("en_revision");
    const periods = plans.periodsOf(sub);
    expect(periods[0].endsAt).toBeLessThan(sub.periods[0].endsAt);
    const cut = periods[0].endsAt;
    const { getPortfolio } = await import("@/lib/portfolio");
    expect(
      (await getPortfolio("u10", cut + 1)).subscriptions[0].paidUntil,
    ).toBe(cut);
    const { generatedKwh } = await import("@/lib/energy/plan-math");
    const solar = (await settings.readConfig()).solar;
    expect(generatedKwh(solar, sub.dailyKwh, periods, cut + 2 * 86400000)).toBe(
      generatedKwh(solar, sub.dailyKwh, periods, cut + 86400000),
    );
    const reversal = await import("@/lib/payments/reversals");
    await expect(reversal.requireNoPaymentReview("u10")).rejects.toMatchObject({
      status: 409,
    });
    const receipts = await import("@/lib/receipts");
    await expect(receipts.receiptData("u10", o.orderId)).rejects.toMatchObject({
      status: 409,
    });
    // Repetir el webhook no desplaza el corte ni duplica el caso.
    await svc.handleMercadoPagoNotification(notification(p.id), deps);
    const [again] = await plans.listSubscriptions("u10");
    expect(plans.periodsOf(again)[0].endsAt).toBe(cut);
    await reversal.resolvePaymentReview(
      { id: "ops", name: "Operaciones" },
      o.orderId,
      "Acuerdo verificado con titular, referencia TEST-123",
    );
    await expect(
      reversal.requireNoPaymentReview("u10"),
    ).resolves.toBeUndefined();
    await svc.handleMercadoPagoNotification(notification(p.id), deps);
    await expect(
      reversal.requireNoPaymentReview("u10"),
    ).resolves.toBeUndefined();
    expect((await orderRow(o.orderId)).note).toMatch(/TEST-123/);
  });

  it("con cobros reales, un pago de una cuenta de prueba no activa el plan", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const o = await order("u11");
    pay(o.orderId, MONTH_180, "approved", { live_mode: false });
    const r = await svc.syncMercadoPagoOrder({ orderId: o.orderId }, deps);
    expect(r?.order.status).toBe("fallida");
    expect(r?.order.note).toMatch(/pago de prueba/i);
    expect(await plans.listSubscriptions("u11")).toHaveLength(0);
  });

  it("otro intento aprobado no oculta una devolución del pago que activó el mes", async () => {
    await createUser("refund-with-duplicate");
    const o = await order("refund-with-duplicate");
    const first = pay(o.orderId, MONTH_180, "approved");
    await svc.handleMercadoPagoNotification(notification(first.id), deps);
    const second = pay(o.orderId, MONTH_180, "approved");
    await svc.handleMercadoPagoNotification(notification(second.id), deps);
    mp.payments.set(String(first.id), { ...first, status: "charged_back" });
    await svc.handleMercadoPagoNotification(notification(first.id), deps);
    expect(await orderRow(o.orderId)).toMatchObject({
      status: "reembolsada",
      providerId: String(first.id),
      providerStatus: "charged_back",
    });
    const [sub] = await plans.listSubscriptions("refund-with-duplicate");
    expect(plans.stateOf(sub)).toBe("en_revision");
    const [duplicate] = await dbMod.db
      .select()
      .from(schema.ledgerTx)
      .where(drizzle.eq(schema.ledgerTx.providerId, String(second.id)));
    expect(duplicate.status).toBe("por_reembolsar");
    expect(sub.periods).toHaveLength(1);
  });
});

describe("meses siguientes y cupo de la planta", () => {
  it("el mes 2 se paga con el plan del usuario y empieza cuando termina el mes 1", async () => {
    const first = await order("u12");
    const p1 = pay(first.orderId, MONTH_180, "approved");
    await svc.handleMercadoPagoNotification(notification(p1.id), deps);
    const [sub] = await plans.listSubscriptions("u12");

    const second = await order("u12", { subscriptionId: sub.id });
    expect(await orderRow(second.orderId)).toMatchObject({
      subscriptionId: sub.id,
      periodIndex: 2,
      amountCop: MONTH_180,
    });
    const p2 = pay(second.orderId, MONTH_180, "approved");
    await svc.handleMercadoPagoNotification(notification(p2.id), deps);
    const periods = (await periodsOf(sub.id)).sort((a, b) => a.idx - b.idx);
    expect(periods.map((p) => p.idx)).toEqual([1, 2]);
    expect(periods[1].startsAt).toBe(periods[0].endsAt);
  });

  it("pagar dos veces el mismo mes deja el segundo pago por reembolsar", async () => {
    const first = await order("u13");
    const again = await order("u13");
    await svc.handleMercadoPagoNotification(
      notification(pay(first.orderId, MONTH_180, "approved").id),
      deps,
    );
    await svc.handleMercadoPagoNotification(
      notification(pay(again.orderId, MONTH_180, "approved").id),
      deps,
    );
    expect((await orderRow(first.orderId)).status).toBe("confirmada");
    const second = await orderRow(again.orderId);
    expect(second.status).toBe("por_reembolsar");
    expect(second.note).toMatch(/ya estaba pagado/);
    expect(await periodsOf(second.subscriptionId)).toHaveLength(1);
  });

  it("el plan de otra empresa no se puede pagar", async () => {
    const [sub] = await plans.listSubscriptions("u12");
    await expect(
      order("u14", { subscriptionId: sub.id }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("si la planta se queda sin cupo entre la orden y el pago, el pago queda por reembolsar", async () => {
    // Una planta en la que solo cabe un Plan 180 más (2.000 kWh al día) además de lo ya contratado.
    const used = await plans.contractedDailyKwh();
    const peakKw = ((used + 2500) * Math.PI) / (2 * 13);
    await dbMod.db.update(schema.plant).set({ peakKw });
    settings.invalidateSettings();

    const a = await order("u15");
    const b = await order("u16");
    await svc.handleMercadoPagoNotification(
      notification(pay(a.orderId, MONTH_180, "approved").id),
      deps,
    );
    await svc.handleMercadoPagoNotification(
      notification(pay(b.orderId, MONTH_180, "approved").id),
      deps,
    );
    expect((await orderRow(a.orderId)).status).toBe("confirmada");
    const late = await orderRow(b.orderId);
    expect(late.status).toBe("por_reembolsar");
    expect(late.note).toMatch(/sin cupo/);
    // Y ya no se pueden crear órdenes nuevas para un plan que no cabe.
    await expect(order("u14")).rejects.toMatchObject({ status: 409 });
    // Quien ya tiene su plan sí puede pagar el mes siguiente: su cupo está apartado.
    const [mine] = await plans.listSubscriptions("u15");
    await expect(
      order("u15", { subscriptionId: mine.id }),
    ).resolves.toMatchObject({ periodIndex: 2 });
  });
});
