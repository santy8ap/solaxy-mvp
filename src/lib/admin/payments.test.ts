import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ChainReader } from "@/lib/payments/chain";
import type { MpPayment } from "@/lib/payments/mercadopago";
import { buildPayerProofMessage } from "@/lib/signing";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-admpay-")), "test.db")}`;
const TREASURY = "0x2222222222222222222222222222222222222222";
vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-prueba");
vi.stubEnv("MERCADOPAGO_API_BASE", "https://mp.falso");
vi.stubEnv("CRYPTO_TREASURY_ADDRESS", TREASURY);
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let payments: typeof import("@/lib/admin/payments");
let admin: typeof import("@/lib/admin/service");
let market: typeof import("@/lib/market");
let mp: typeof import("@/lib/payments/mercadopago-service");
let crypto: typeof import("@/lib/payments/crypto-service");
let prices: typeof import("@/lib/payments/prices");
let profile: typeof import("@/lib/profile");
let settings: typeof import("@/lib/settings");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const actor = { id: "admin-test", name: "Admin de prueba" };
const PROFILE = { fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true };

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
  market = await import("@/lib/market");
  mp = await import("@/lib/payments/mercadopago-service");
  crypto = await import("@/lib/payments/crypto-service");
  prices = await import("@/lib/payments/prices");
  profile = await import("@/lib/profile");
  settings = await import("@/lib/settings");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
  for (const u of ["inv-070", "inv-071", "inv-072", "inv-073"]) await profile.saveProfile(u, PROFILE);
}, 120_000);

afterEach(() => {
  vi.stubEnv("DEMO_MODE", "");
});

describe("retiros con dinero real", () => {
  async function requestWithdrawal(userId: string, amountCop: number) {
    const acct = privateKeyToAccount(generatePrivateKey());
    const w = await market.createWithdrawal({ userId, amountCop, walletAddress: acct.address, walletName: "Trust Wallet", chainId: 56 });
    return market.confirmWithdrawal(userId, w.withdrawalId, await acct.signMessage({ message: w.message }));
  }

  it("al aprobar exige la referencia del envío y la guarda", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const w = await requestWithdrawal("inv-020", 30_000);
    await expect(admin.decideWithdrawal(actor, w.id, "aprobar")).rejects.toThrow(/referencia/i);
    const ref = hashOf("envio-1");
    const ok = await admin.decideWithdrawal(actor, w.id, "aprobar", "", ref);
    expect(ok).toMatchObject({ status: "confirmada", txHash: ref });
  });

  it("en modo demo, sin referencia se genera un hash simulado", async () => {
    const w = await requestWithdrawal("inv-031", 25_000);
    const ok = await admin.decideWithdrawal(actor, w.id, "aprobar");
    expect(ok.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("con dinero real no se puede apagar la aprobación de retiros", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const current = await settings.readSettings();
    await expect(admin.updatePlantSettings(actor, { ...current, withdrawalApproval: false })).rejects.toThrow(/aprobación|administrador/i);
  });
});

describe("sección Pagos del admin", () => {
  it("lista las órdenes de pago con su método, estado y usuario", async () => {
    const o = await mp.createMercadoPagoOrder({ userId: "inv-070", email: "a@b.co", kw: 0.5 }, { fetch: mpFetch });
    const list = await payments.listPayments({ method: "mercadopago" });
    const row = list.find((p) => p.id === o.orderId);
    expect(row).toMatchObject({ method: "mercadopago", status: "pendiente", userName: expect.any(String) });
  });

  it("re-verifica un pago de Mercado Pago buscándolo por la referencia de la orden", async () => {
    const o = await mp.createMercadoPagoOrder({ userId: "inv-071", email: "a@b.co", kw: 0.5 }, { fetch: mpFetch });
    // El usuario pagó pero cerró la pestaña y el webhook nunca llegó.
    mpPayments.push({ id: 777001, status: "approved", external_reference: o.orderId, transaction_amount: (await orderRow(o.orderId)).amountCop, currency_id: "COP", live_mode: true });
    const r = await payments.reverifyPayment(actor, o.orderId, { fetch: mpFetch });
    expect(r.status).toBe("confirmada");
  });

  it("registra a mano el hash de un pago cripto y lo verifica", async () => {
    prices.resetPriceCache();
    const payer = privateKeyToAccount(generatePrivateKey());
    const issuedAt = Date.now();
    const signature = await payer.signMessage({ message: buildPayerProofMessage({ userId: "inv-072", payer: payer.address, issuedAt }) });
    const q = await crypto.createCryptoQuote({ userId: "inv-072", kw: 0.5, asset: "BNB", payer: payer.address, walletName: "MetaMask", proof: { issuedAt, signature } }, { fetch: priceFetch });
    const hash = hashOf("pago-cripto-admin");
    chainTxs.set(hash, { from: payer.address, value: BigInt(q.amountBaseUnits), block: latest.n - 20n });
    const r = await payments.attachCryptoHash(actor, q.orderId, hash, { reader });
    expect(r.status).toBe("confirmada");
  });

  it("marca como reembolsado un pago por reembolsar y deja la referencia", async () => {
    const o = await mp.createMercadoPagoOrder({ userId: "inv-073", email: "a@b.co", kw: 0.5 }, { fetch: mpFetch });
    mpPayments.push({ id: 777002, status: "approved", external_reference: o.orderId, transaction_amount: 100, currency_id: "COP", live_mode: true });
    await mp.syncMercadoPagoOrder({ orderId: o.orderId }, { fetch: mpFetch });
    expect((await orderRow(o.orderId)).status).toBe("por_reembolsar");
    const r = await payments.markRefunded(actor, o.orderId, "Devolución Mercado Pago 12345");
    expect(r).toMatchObject({ status: "reembolsada" });
    expect(r.note).toMatch(/12345/);
    await expect(payments.markRefunded(actor, o.orderId, "otra vez")).rejects.toMatchObject({ status: 409 });
  });
});
