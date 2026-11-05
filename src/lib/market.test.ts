import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Base de datos temporal y aislada para esta prueba (antes de importar los módulos).
process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-market-")), "test.db")}`;

let market: typeof import("@/lib/market");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

beforeAll(async () => {
  market = await import("@/lib/market");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
}, 120_000);

describe("confirmación de compras", () => {
  it("dos confirmaciones simultáneas de la misma orden asignan los kW una sola vez", async () => {
    const acct = privateKeyToAccount(generatePrivateKey());
    const userId = "inv-001";
    const order = await market.createBuyOrder({
      userId,
      kw: 1,
      asset: "USDT",
      network: "BNB Smart Chain (BEP-20)",
      chainId: 56,
      walletAddress: acct.address,
      walletName: "Trust Wallet",
    });
    const signature = await acct.signMessage({ message: order.message });
    await Promise.allSettled([
      market.confirmBuyOrder(userId, order.orderId, { signature }),
      market.confirmBuyOrder(userId, order.orderId, { signature }),
    ]);
    const { positionEntry } = schema;
    const rows = await dbMod.db.select().from(positionEntry).where(drizzle.eq(positionEntry.txId, order.orderId));
    expect(rows).toHaveLength(1);
  }, 60_000);

  it("rechaza la confirmación con la firma de otra wallet", async () => {
    const acct = privateKeyToAccount(generatePrivateKey());
    const other = privateKeyToAccount(generatePrivateKey());
    const order = await market.createBuyOrder({
      userId: "inv-002",
      kw: 0.5,
      asset: "BNB",
      network: "BNB Smart Chain",
      chainId: 56,
      walletAddress: acct.address,
      walletName: "MetaMask",
    });
    const signature = await other.signMessage({ message: order.message });
    await expect(market.confirmBuyOrder("inv-002", order.orderId, { signature })).rejects.toThrow(/firma/i);
  }, 60_000);
});

describe("con dinero real (DEMO_MODE=false)", () => {
  afterEach(() => vi.unstubAllEnvs());

  const demoOrder = (userId: string, address: `0x${string}`) =>
    market.createBuyOrder({ userId, kw: 0.5, asset: "USDT", network: "BNB Smart Chain (BEP-20)", chainId: 56, walletAddress: address, walletName: "Trust Wallet" });

  it("no se crean órdenes de pago simulado", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const acct = privateKeyToAccount(generatePrivateKey());
    await expect(demoOrder("inv-003", acct.address)).rejects.toThrow(/demo/i);
  });

  it("una firma no asigna kW aunque la orden se haya creado en modo demo", async () => {
    const acct = privateKeyToAccount(generatePrivateKey());
    const order = await demoOrder("inv-004", acct.address);
    const signature = await acct.signMessage({ message: order.message });
    vi.stubEnv("DEMO_MODE", "false");
    await expect(market.confirmBuyOrder("inv-004", order.orderId, { signature })).rejects.toThrow(/demo/i);
    const { positionEntry } = schema;
    const rows = await dbMod.db.select().from(positionEntry).where(drizzle.eq(positionEntry.txId, order.orderId));
    expect(rows).toHaveLength(0);
  });

  it("los retiros siempre esperan al administrador, aunque la aprobación esté apagada", async () => {
    const { plant } = schema;
    await dbMod.db.update(plant).set({ withdrawalApproval: false });
    (await import("@/lib/settings")).invalidateSettings();
    vi.stubEnv("DEMO_MODE", "false");
    const acct = privateKeyToAccount(generatePrivateKey());
    const w = await market.createWithdrawal({ userId: "inv-005", amountCop: 25_000, walletAddress: acct.address, walletName: "Trust Wallet", chainId: 56 });
    const signature = await acct.signMessage({ message: w.message });
    const tx = await market.confirmWithdrawal("inv-005", w.withdrawalId, signature);
    expect(tx.status).toBe("por_aprobar");
    expect(tx.txHash).toBeNull();
  });
});
