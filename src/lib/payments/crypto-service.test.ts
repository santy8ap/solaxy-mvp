import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainReader } from "@/lib/payments/chain";
import { TRANSFER_TOPIC, type ChainReceipt, type ChainTx } from "@/lib/payments/crypto";
import { buildPayerProofMessage } from "@/lib/signing";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-crypto-")), "test.db")}`;
const TREASURY = "0x2222222222222222222222222222222222222222";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
vi.stubEnv("CRYPTO_TREASURY_ADDRESS", TREASURY);
vi.stubEnv("CRYPTO_NETWORK", "bsc");
vi.stubEnv("CRYPTO_CONFIRMATIONS", "5");

let svc: typeof import("@/lib/payments/crypto-service");
let prices: typeof import("@/lib/payments/prices");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

/** CoinGecko falso: 1 USDT = 4.000 COP, 1 BNB = 2.800.000 COP. */
let priceDown = false;
const fakePrices = (async () => {
  if (priceDown) throw new Error("sin red");
  return new Response(JSON.stringify({ tether: { cop: 4000 }, binancecoin: { cop: 2_800_000 } }), { status: 200 });
}) as unknown as typeof fetch;

/** Cadena falsa en memoria. */
const chain = {
  latest: 1000n,
  txs: new Map<string, ChainTx>(),
  receipts: new Map<string, ChainReceipt>(),
  times: new Map<bigint, number>(),
};
const reader: ChainReader = {
  getChainId: async () => 56,
  getTransaction: async (h) => chain.txs.get(h.toLowerCase()) ?? null,
  getReceipt: async (h) => chain.receipts.get(h.toLowerCase()) ?? null,
  getBlockNumber: async () => chain.latest,
  getBlockTimestamp: async (n) => chain.times.get(n) ?? Math.floor(Date.now() / 1000),
};
let hashSeq = 0;
const newHash = () => `0x${(++hashSeq).toString(16).padStart(64, "0")}` as `0x${string}`;
const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}` as `0x${string}`;

/** "Mina" un pago en la cadena falsa. */
function mine(opts: { from: string; asset: "BNB" | "USDT"; amount: bigint; to?: string; block?: bigint }) {
  const hash = newHash();
  const block = opts.block ?? chain.latest;
  const to = opts.to ?? TREASURY;
  chain.txs.set(hash, { hash, from: opts.from, to: opts.asset === "BNB" ? to : USDT, value: opts.asset === "BNB" ? opts.amount : 0n });
  chain.receipts.set(hash, {
    status: "success",
    blockNumber: block,
    logs:
      opts.asset === "USDT"
        ? [{ address: USDT, topics: [TRANSFER_TOPIC, pad(opts.from), pad(to)], data: `0x${opts.amount.toString(16).padStart(64, "0")}` }]
        : [],
  });
  chain.times.set(block, Math.floor(Date.now() / 1000));
  return hash;
}

const deps = { fetch: fakePrices, reader };
/** Wallets de prueba con llave real: firman la prueba de que la wallet es del usuario. */
const accounts = new Map<number, PrivateKeyAccount>();
const acct = (n: number) => {
  if (!accounts.has(n)) accounts.set(n, privateKeyToAccount(generatePrivateKey()));
  return accounts.get(n)!;
};
const wallet = (n: number) => acct(n).address;
async function proofFor(userId: string, signer: PrivateKeyAccount, payer = signer.address, issuedAt = Date.now()) {
  return { issuedAt, signature: await signer.signMessage({ message: buildPayerProofMessage({ userId, payer, issuedAt }) }) };
}
/** Cotiza como lo hace la interfaz: con la firma de la wallet que paga. */
async function quote(userId: string, n: number, input: { planId?: string; subscriptionId?: string; asset: "USDT" | "BNB"; walletName?: string }) {
  return svc.createCryptoQuote(
    { userId, payer: wallet(n), walletName: input.walletName ?? "MetaMask", planId: input.planId, subscriptionId: input.subscriptionId, asset: input.asset, proof: await proofFor(userId, acct(n)) },
    deps,
  );
}

/** Meses de energía que activó una orden (0 o 1). */
async function entriesOf(orderId: string) {
  return dbMod.db.select().from(schema.planPeriod).where(drizzle.eq(schema.planPeriod.txId, orderId));
}
async function orderRow(orderId: string) {
  const [row] = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.id, orderId));
  return row;
}

beforeAll(async () => {
  svc = await import("@/lib/payments/crypto-service");
  prices = await import("@/lib/payments/prices");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  for (let i = 50; i <= 60; i++) await createUser(`inv-0${i}`);
  await createUser("inv-070", { profile: false });
}, 120_000);

beforeEach(() => {
  priceDown = false;
  prices.resetPriceCache();
  vi.stubEnv("CRYPTO_NETWORK", "bsc");
  vi.stubEnv("DEMO_MODE", "");
});

describe("cotización cripto", () => {
  it("sin precio en vivo no se cotiza ni se crea la orden", async () => {
    priceDown = true;
    await expect(quote("inv-050", 50, { planId: "p180", asset: "BNB", walletName: "MetaMask" })).rejects.toMatchObject({ status: 503 });
    const rows = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.and(drizzle.eq(schema.ledgerTx.userId, "inv-050"), drizzle.eq(schema.ledgerTx.method, "crypto")));
    expect(rows).toHaveLength(0);
  });

  it("sin los datos de la empresa no se cotiza", async () => {
    await expect(quote("inv-070", 70, { planId: "p180", asset: "BNB", walletName: "MetaMask" })).rejects.toMatchObject({ status: 412 });
  });

  it("crea la orden con el monto exacto, la billetera destino y 20 minutos de vigencia", async () => {
    const before = Date.now();
    const q = await quote("inv-051", 51, { planId: "p180", asset: "USDT", walletName: "Trust Wallet" });
    const row = await orderRow(q.orderId);
    expect(q).toMatchObject({ asset: "USDT", to: TREASURY, tokenContract: USDT, chainId: 56 });
    expect(BigInt(q.amountBaseUnits) * 4000n).toBeGreaterThanOrEqual(BigInt(row.amountCop) * 10n ** 18n);
    expect(row).toMatchObject({ method: "crypto", status: "pendiente", expectedAmount: q.amountBaseUnits, walletAddress: getAddress(wallet(51)) });
    expect(row.expiresAt! - before).toBeGreaterThanOrEqual(20 * 60_000 - 1000);
  });
});

describe("red de pruebas", () => {
  it("con cobros reales no se acepta cripto de la red de pruebas", async () => {
    vi.stubEnv("CRYPTO_NETWORK", "bsc-testnet");
    vi.stubEnv("DEMO_MODE", "false");
    await expect(quote("inv-051", 51, { planId: "p180", asset: "BNB" })).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/red de pruebas/) });
  });

  it("en modo de pruebas sí se puede cotizar en la red de pruebas", async () => {
    vi.stubEnv("CRYPTO_NETWORK", "bsc-testnet");
    await expect(quote("inv-051", 51, { planId: "p180", asset: "BNB" })).resolves.toMatchObject({ chainId: 97, planName: "Plan 180", periodIndex: 1 });
  });
});

describe("la wallet que paga debe ser del usuario", () => {
  it("no se puede cotizar con una wallet ajena (sin la firma de esa wallet)", async () => {
    const victim = acct(61);
    const thief = acct(62);
    // El ladrón pone la dirección de la víctima, pero firma con su propia llave.
    const proof = await proofFor("inv-058", thief, victim.address);
    await expect(svc.createCryptoQuote({ userId: "inv-058", planId: "p180", asset: "BNB", payer: victim.address, walletName: "MetaMask", proof }, deps)).rejects.toMatchObject({ status: 403 });
  });

  it("la firma es para esta cuenta: no sirve la de otro usuario", async () => {
    const proof = await proofFor("inv-057", acct(63));
    await expect(svc.createCryptoQuote({ userId: "inv-058", planId: "p180", asset: "BNB", payer: wallet(63), walletName: "MetaMask", proof }, deps)).rejects.toMatchObject({ status: 403 });
  });

  it("una firma vieja no sirve", async () => {
    const proof = await proofFor("inv-058", acct(64), wallet(64), Date.now() - 60 * 60_000);
    await expect(svc.createCryptoQuote({ userId: "inv-058", planId: "p180", asset: "BNB", payer: wallet(64), walletName: "MetaMask", proof }, deps)).rejects.toMatchObject({ status: 403 });
  });
});

describe("verificación en la cadena", () => {
  it("espera las confirmaciones y activa el mes una sola vez", async () => {
    const q = await quote("inv-052", 52, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    const hash = mine({ from: wallet(52), asset: "BNB", amount: BigInt(q.amountBaseUnits), block: chain.latest - 1n });
    const first = await svc.submitCryptoPayment({ userId: "inv-052", orderId: q.orderId, txHash: hash }, deps);
    expect(first).toMatchObject({ state: "esperando", confirmations: 2, needed: 5 });
    expect((await orderRow(q.orderId)).status).toBe("verificando");
    chain.latest += 3n;
    await Promise.all([svc.verifyCryptoOrder(q.orderId, deps), svc.verifyCryptoOrder(q.orderId, deps), svc.verifyCryptoOrder(q.orderId, deps)]);
    expect((await orderRow(q.orderId)).status).toBe("confirmada");
    expect(await entriesOf(q.orderId)).toHaveLength(1);
  });

  it("un hash ya usado no sirve para otra orden", async () => {
    const a = await quote("inv-053", 53, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    const hash = mine({ from: wallet(53), asset: "BNB", amount: BigInt(a.amountBaseUnits), block: chain.latest - 10n });
    await svc.submitCryptoPayment({ userId: "inv-053", orderId: a.orderId, txHash: hash }, deps);
    expect((await orderRow(a.orderId)).status).toBe("confirmada");
    const b = await quote("inv-053", 53, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    await expect(svc.submitCryptoPayment({ userId: "inv-053", orderId: b.orderId, txHash: hash }, deps)).rejects.toMatchObject({ status: 409 });
    expect(await entriesOf(b.orderId)).toHaveLength(0);
  });

  it("si alguien registra el hash de otra persona, falla y el hash queda libre para su dueño", async () => {
    const victim = await quote("inv-054", 54, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    const thief = await quote("inv-055", 55, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    const hash = mine({ from: wallet(54), asset: "BNB", amount: BigInt(victim.amountBaseUnits), block: chain.latest - 10n });
    const stolen = await svc.submitCryptoPayment({ userId: "inv-055", orderId: thief.orderId, txHash: hash }, deps);
    expect(stolen.state).toBe("fallida");
    const ok = await svc.submitCryptoPayment({ userId: "inv-054", orderId: victim.orderId, txHash: hash }, deps);
    expect(ok.state).toBe("confirmada");
  });

  it("un pago incompleto queda por reembolsar sin activar el mes", async () => {
    const q = await quote("inv-056", 56, { planId: "p180", asset: "USDT", walletName: "Trust Wallet" });
    const hash = mine({ from: wallet(56), asset: "USDT", amount: BigInt(q.amountBaseUnits) / 2n, block: chain.latest - 10n });
    const r = await svc.submitCryptoPayment({ userId: "inv-056", orderId: q.orderId, txHash: hash }, deps);
    expect(r.state).toBe("por_reembolsar");
    expect(r.order.note).toMatch(/incompleto/i);
    expect(await entriesOf(q.orderId)).toHaveLength(0);
  });

  it("solo el dueño de la orden puede registrar el pago", async () => {
    const q = await quote("inv-057", 57, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    await expect(svc.submitCryptoPayment({ userId: "inv-058", orderId: q.orderId, txHash: newHash() }, deps)).rejects.toMatchObject({ status: 404 });
  });

  it("si el nodo está en otra red, no verifica nada", async () => {
    const q = await quote("inv-059", 59, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    const hash = mine({ from: wallet(59), asset: "BNB", amount: BigInt(q.amountBaseUnits), block: chain.latest - 10n });
    // Un nodo mal configurado (testnet) aunque la app espera BNB Chain.
    const wrongNode: ChainReader = { ...reader, getChainId: async () => 97 };
    await expect(svc.submitCryptoPayment({ userId: "inv-059", orderId: q.orderId, txHash: hash }, { ...deps, reader: wrongNode })).rejects.toMatchObject({ status: 503 });
    expect(await entriesOf(q.orderId)).toHaveLength(0);
  });

  it("al abrir el panel se reintentan los pagos que quedaron verificando", async () => {
    const q = await quote("inv-060", 60, { planId: "p180", asset: "BNB", walletName: "MetaMask" });
    const hash = mine({ from: wallet(60), asset: "BNB", amount: BigInt(q.amountBaseUnits), block: chain.latest });
    expect((await svc.submitCryptoPayment({ userId: "inv-060", orderId: q.orderId, txHash: hash }, deps)).state).toBe("esperando");
    chain.latest += 10n;
    await svc.retryUserCryptoOrders("inv-060", deps);
    expect((await orderRow(q.orderId)).status).toBe("confirmada");
  });
});
