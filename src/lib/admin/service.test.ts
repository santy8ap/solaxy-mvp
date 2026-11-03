import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-admin-")), "test.db")}`;

let admin: typeof import("@/lib/admin/service");
let market: typeof import("@/lib/market");
let portfolio: typeof import("@/lib/portfolio");
let settings: typeof import("@/lib/settings");
const actor = { id: "admin-test", name: "Admin de prueba" };
const DAY = 86_400_000;

beforeAll(async () => {
  admin = await import("@/lib/admin/service");
  market = await import("@/lib/market");
  portfolio = await import("@/lib/portfolio");
  settings = await import("@/lib/settings");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
}, 120_000);

describe("ajuste de kW por el administrador", () => {
  it("suma kW con fecha de inicio pasada, deja el movimiento y la bitácora", async () => {
    const before = await portfolio.getKwPosition("inv-010");
    const res = await admin.adjustUserKw(actor, { userId: "inv-010", mode: "delta", kw: 5, sinceDays: 30, reason: "Bono de bienvenida" });
    const after = await portfolio.getKwPosition("inv-010");
    expect(after.kw).toBeCloseTo(before.kw + 5, 6);
    const entry = after.entries.find((e) => Math.abs(e.kwDelta - 5) < 1e-9 && Date.now() - e.ts > 29 * DAY);
    expect(entry).toBeDefined();
    expect(res.deltaKw).toBe(5);
    const log = await admin.listAudit(5);
    expect(log[0]).toMatchObject({ action: "ajuste_kw", targetUserId: "inv-010" });
  });

  it("fija un total menor y la resta aplica desde hoy", async () => {
    await admin.adjustUserKw(actor, { userId: "inv-011", mode: "set", kw: 0.5, sinceDays: 0, reason: "Corrección" });
    const pos = await portfolio.getKwPosition("inv-011");
    expect(pos.kw).toBeCloseTo(0.5, 6);
  });

  it("no deja quitar más kW de los que tiene ni pasar la capacidad de la planta", async () => {
    await expect(admin.adjustUserKw(actor, { userId: "inv-012", mode: "delta", kw: -9999, sinceDays: 0, reason: "x" })).rejects.toThrow(/no tiene/i);
    await expect(admin.adjustUserKw(actor, { userId: "inv-012", mode: "delta", kw: 50_000, sinceDays: 0, reason: "x" })).rejects.toThrow(/capacidad|disponibles/i);
  });
});

describe("aprobación de retiros", () => {
  beforeAll(async () => {
    // Saldo garantizado: 10 kW desde hace 90 días.
    for (const userId of ["inv-020", "inv-021"]) {
      await admin.adjustUserKw(actor, { userId, mode: "delta", kw: 10, sinceDays: 90, reason: "Saldo para la prueba" });
    }
  });

  async function requestWithdrawal(userId: string, amountCop: number) {
    const acct = privateKeyToAccount(generatePrivateKey());
    const w = await market.createWithdrawal({ userId, amountCop, walletAddress: acct.address, walletName: "Trust Wallet", chainId: 56 });
    const signature = await acct.signMessage({ message: w.message });
    return market.confirmWithdrawal(userId, w.withdrawalId, signature);
  }

  it("con aprobación activa, el retiro queda por aprobar y aparta el saldo", async () => {
    const userId = "inv-020";
    const { entries } = await portfolio.getKwPosition(userId);
    const before = await portfolio.getBalances(userId, entries, Date.now());
    const tx = await requestWithdrawal(userId, 50_000);
    expect(tx.status).toBe("por_aprobar");
    const after = await portfolio.getBalances(userId, entries, Date.now());
    expect(after.reserved).toBe(50_000);
    expect(after.balance).toBeLessThan(before.balance - 49_000);
  });

  it("al aprobar queda confirmado con hash; al rechazar se libera el saldo", async () => {
    const userId = "inv-021";
    const a = await requestWithdrawal(userId, 30_000);
    const ok = await admin.decideWithdrawal(actor, a.id, "aprobar");
    expect(ok.status).toBe("confirmada");
    expect(ok.txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const b = await requestWithdrawal(userId, 20_000);
    const no = await admin.decideWithdrawal(actor, b.id, "rechazar", "Datos incompletos");
    expect(no.status).toBe("rechazada");
    const { entries } = await portfolio.getKwPosition(userId);
    const bal = await portfolio.getBalances(userId, entries, Date.now());
    expect(bal.reserved).toBe(0);
    await expect(admin.decideWithdrawal(actor, b.id, "aprobar")).rejects.toThrow(/ya fue/i);
  });
});

describe("configuración de la planta", () => {
  it("guarda cambios válidos, deja bitácora y rechaza los inválidos", async () => {
    const current = await settings.readSettings();
    await admin.updatePlantSettings(actor, { ...current, pricePerKwCop: 5_100_000, withdrawalApproval: true });
    settings.invalidateSettings();
    expect((await settings.readSettings()).pricePerKwCop).toBe(5_100_000);
    await expect(admin.updatePlantSettings(actor, { ...current, capacityKwp: 200 })).rejects.toThrow(/vendidos/);
    const log = await admin.listAudit(3);
    expect(log.some((l) => l.action === "config_planta")).toBe(true);
  });
});
