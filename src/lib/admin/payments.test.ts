import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ChainReader } from "@/lib/payments/chain";
import type { MpPayment } from "@/lib/payments/mercadopago";
import { buildPayerProofMessage } from "@/lib/signing";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-admpay-")), "test.db")}`;
const TREASURY = "0x2222222222222222222222222222222222222222";
vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-prueba");
vi.stubEnv("MERCADOPAGO_API_BASE", "https://mp.falso");
vi.stubEnv("CRYPTO_TREASURY_ADDRESS", TREASURY);
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let payments: typeof import("@/lib/admin/payments");
let admin: typeof import("@/lib/admin/service");
let mp: typeof import("@/lib/payments/mercadopago-service");
let crypto: typeof import("@/lib/payments/crypto-service");
let prices: typeof import("@/lib/payments/prices");
let test: typeof import("@/lib/payments/test-payment");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const actor = { id: "admin-test", name: "Admin de prueba" };
const MONTH_180 = 20_880_000;

/** Mercado Pago falso: preferencias y pagos buscables por referencia. */
const mpPayments: MpPayment[] = [];
const mpFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.pathname === "/checkout/preferences" && init?.method === "POST") {
    return new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp.falso/checkout" }), { status: 201 });
  }
  if (url.pathname === "/v1/payments/search") {
    const ref = url.searchParams.get("external_reference");
    return new Response(JSON.stringify({ results: mpPayments.filter((p) => p.external_reference === ref) }));
  }
  const m = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
  const p = m ? mpPayments.find((x) => String(x.id) === m[1]) : undefined;
  return new Response(JSON.stringify(p ?? {}), { status: p ? 200 : 404 });
}) as typeof fetch;
const priceFetch = (async () => new Response(JSON.stringify({ tether: { cop: 4000 }, binancecoin: { cop: 2_800_000 } }))) as unknown as typeof fetch;

const latest = { n: 500n };
const chainTxs = new Map<string, { from: string; value: bigint; block: bigint }>();
const reader: ChainReader = {
  getChainId: async () => 56,
  getBlockNumber: async () => latest.n,
  getBlockTimestamp: async () => Math.floor(Date.now() / 1000),
  getTransaction: async (h) => {
    const t = chainTxs.get(h.toLowerCase());
    return t ? { hash: h, from: t.from, to: TREASURY, value: t.value } : null;
  },
  getReceipt: async (h) => {
    const t = chainTxs.get(h.toLowerCase());
    return t ? { status: "success", blockNumber: t.block, logs: [] } : null;
  },
};
const hashOf = (s: string) => `0x${createHash("sha256").update(s).digest("hex")}` as `0x${string}`;

async function orderRow(id: string) {
  const [row] = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.id, id));
  return row;
}

beforeAll(async () => {
  payments = await import("@/lib/admin/payments");
  admin = await import("@/lib/admin/service");
  mp = await import("@/lib/payments/mercadopago-service");
  crypto = await import("@/lib/payments/crypto-service");
  prices = await import("@/lib/payments/prices");
  test = await import("@/lib/payments/test-payment");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  for (const u of ["p1", "p2", "p3", "p4", "p5"]) await createUser(u);
}, 120_000);

afterEach(() => {
  vi.stubEnv("DEMO_MODE", "");
});

describe("sección Pagos del admin", () => {
  it("lista los pagos con su método, estado, empresa y plan", async () => {
    const o = await mp.createMercadoPagoOrder({ userId: "p1", email: "a@b.co", planId: "p180" }, { fetch: mpFetch });
    const list = await payments.listPayments({ method: "mercadopago" });
    const row = list.find((p) => p.id === o.orderId);
    expect(row).toMatchObject({ method: "mercadopago", status: "pendiente", companyName: "Empresa p1", planName: "Plan 180", periodIndex: 1, amountCop: MONTH_180 });
    expect(await payments.listPayments({ status: "confirmadas" })).toHaveLength(0);
  });

  it("re-verifica un pago de Mercado Pago buscándolo por la referencia de la orden", async () => {
    const o = await mp.createMercadoPagoOrder({ userId: "p2", email: "a@b.co", planId: "p180" }, { fetch: mpFetch });
    // El usuario pagó pero cerró la pestaña y la notificación nunca llegó.
    mpPayments.push({ id: 777001, status: "approved", external_reference: o.orderId, transaction_amount: MONTH_180, currency_id: "COP", live_mode: true });
    const r = await payments.reverifyPayment(actor, o.orderId, { fetch: mpFetch });
    expect(r.status).toBe("confirmada");
    expect((await admin.listAudit(1))[0]).toMatchObject({ action: "reverificar_pago", targetUserId: "p2" });
  });

  it("registra a mano el hash de un pago cripto y lo verifica", async () => {
    prices.resetPriceCache();
    const payer = privateKeyToAccount(generatePrivateKey());
    const issuedAt = Date.now();
    const signature = await payer.signMessage({ message: buildPayerProofMessage({ userId: "p3", payer: payer.address, issuedAt }) });
    const q = await crypto.createCryptoQuote({ userId: "p3", planId: "p180", asset: "BNB", payer: payer.address, walletName: "MetaMask", proof: { issuedAt, signature } }, { fetch: priceFetch });
    const hash = hashOf("pago-cripto-admin");
    chainTxs.set(hash, { from: payer.address, value: BigInt(q.amountBaseUnits), block: latest.n - 20n });
    const r = await payments.attachCryptoHash(actor, q.orderId, hash, { reader });
    expect(r.status).toBe("confirmada");
  });

  it("marca como reembolsado un pago por reembolsar y deja la referencia", async () => {
    const o = await mp.createMercadoPagoOrder({ userId: "p4", email: "a@b.co", planId: "p180" }, { fetch: mpFetch });
    mpPayments.push({ id: 777002, status: "approved", external_reference: o.orderId, transaction_amount: 100, currency_id: "COP", live_mode: true });
    await mp.syncMercadoPagoOrder({ orderId: o.orderId }, { fetch: mpFetch });
    expect((await orderRow(o.orderId)).status).toBe("por_reembolsar");
    const r = await payments.markRefunded(actor, o.orderId, "Devolución Mercado Pago 12345");
    expect(r).toMatchObject({ status: "reembolsada" });
    expect(r.note).toMatch(/12345/);
    await expect(payments.markRefunded(actor, o.orderId, "otra vez")).rejects.toMatchObject({ status: 409 });
  });

  it("el recaudo: en modo de pruebas incluye los pagos de prueba; con dinero real, solo el dinero real", async () => {
    const before = await payments.paymentSummary();
    await test.payWithTestPayment({ userId: "p5", planId: "p180" });
    // En pruebas, el número se mueve con lo que el administrador está probando.
    expect((await payments.paymentSummary()).totalCop).toBe(before.totalCop + MONTH_180);

    vi.stubEnv("DEMO_MODE", "false");
    const real = await payments.paymentSummary();
    expect(real.totalCop).toBeLessThanOrEqual(before.totalCop);
    await admin.registerManualPayment(actor, { userId: "p5", planId: "p360", reference: "TRANSF-9001" });
    const after = await payments.paymentSummary();
    expect(after.totalCop).toBe(real.totalCop + 40_800_000);
    expect(after.todayCop).toBe(real.todayCop + 40_800_000);
  });

  it("un pago de prueba no se re-verifica con un proveedor", async () => {
    const [demo] = await payments.listPayments({ method: "demo" });
    await expect(payments.reverifyPayment(actor, demo.id)).rejects.toMatchObject({ status: 409 });
  });
});
