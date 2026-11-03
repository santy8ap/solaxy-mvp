import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
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
