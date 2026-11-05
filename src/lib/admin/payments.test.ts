import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ChainReader } from "@/lib/payments/chain";
import type { WompiTransaction } from "@/lib/payments/wompi";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-admpay-")), "test.db")}`;
const TREASURY = "0x2222222222222222222222222222222222222222";
vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_llave");
vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
vi.stubEnv("WOMPI_EVENTS_SECRET", "test_events_x");
vi.stubEnv("WOMPI_API_BASE", "https://wompi.falso/v1");
vi.stubEnv("CRYPTO_TREASURY_ADDRESS", TREASURY);
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let payments: typeof import("@/lib/admin/payments");
let admin: typeof import("@/lib/admin/service");
let market: typeof import("@/lib/market");
let wompi: typeof import("@/lib/payments/wompi-service");
let crypto: typeof import("@/lib/payments/crypto-service");
let prices: typeof import("@/lib/payments/prices");
let profile: typeof import("@/lib/profile");
let settings: typeof import("@/lib/settings");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const actor = { id: "admin-test", name: "Admin de prueba" };
const PROFILE = { fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true };

const wompiTxs = new Map<string, WompiTransaction>();
const wompiFetch = (async (input: RequestInfo | URL) => {
  const id = decodeURIComponent(String(input).split("/transactions/")[1] ?? "");
  const tx = wompiTxs.get(id);
  return new Response(JSON.stringify(tx ? { data: tx } : {}), { status: tx ? 200 : 404 });
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
  wompi = await import("@/lib/payments/wompi-service");
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
    const o = await wompi.createWompiOrder({ userId: "inv-070", email: "a@b.co", kw: 0.5 });
    const list = await payments.listPayments({ method: "wompi" });
    const row = list.find((p) => p.id === o.orderId);
    expect(row).toMatchObject({ method: "wompi", status: "pendiente", userName: expect.any(String) });
  });

  it("re-verifica un pago de Wompi consultando la transacción", async () => {
    const o = await wompi.createWompiOrder({ userId: "inv-071", email: "a@b.co", kw: 0.5 });
    const cents = Number((await orderRow(o.orderId)).expectedAmount);
    // El usuario volvió con PENDING y luego Wompi lo aprobó, pero el webhook nunca llegó.
    const tx: WompiTransaction = { id: "999-1-1", status: "PENDING", reference: o.orderId, amount_in_cents: cents, currency: "COP" };
    wompiTxs.set(tx.id, tx);
    await wompi.syncWompiTransaction(tx.id, { fetch: wompiFetch });
    tx.status = "APPROVED";
    const r = await payments.reverifyPayment(actor, o.orderId, { fetch: wompiFetch });
    expect(r.status).toBe("confirmada");
  });

  it("registra a mano el hash de un pago cripto y lo verifica", async () => {
    prices.resetPriceCache();
    const q = await crypto.createCryptoQuote({ userId: "inv-072", kw: 0.5, asset: "BNB", payer: "0x7777777777777777777777777777777777777777", walletName: "MetaMask" }, { fetch: priceFetch });
    const hash = hashOf("pago-cripto-admin");
    chainTxs.set(hash, { from: "0x7777777777777777777777777777777777777777", value: BigInt(q.amountBaseUnits), block: latest.n - 20n });
    const r = await payments.attachCryptoHash(actor, q.orderId, hash, { reader });
    expect(r.status).toBe("confirmada");
  });

  it("marca como reembolsado un pago por reembolsar y deja la referencia", async () => {
    const o = await wompi.createWompiOrder({ userId: "inv-073", email: "a@b.co", kw: 0.5 });
    const tx: WompiTransaction = { id: "999-2-2", status: "APPROVED", reference: o.orderId, amount_in_cents: 100, currency: "COP" };
    wompiTxs.set(tx.id, tx);
    await wompi.syncWompiTransaction(tx.id, { fetch: wompiFetch });
    expect((await orderRow(o.orderId)).status).toBe("por_reembolsar");
    const r = await payments.markRefunded(actor, o.orderId, "Reembolso Wompi 12345");
    expect(r).toMatchObject({ status: "reembolsada" });
    expect(r.note).toMatch(/12345/);
    await expect(payments.markRefunded(actor, o.orderId, "otra vez")).rejects.toMatchObject({ status: 409 });
  });
});
