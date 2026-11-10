import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DAY_MS, bogotaMs } from "@/lib/time";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-retiros-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let portfolio: typeof import("@/lib/portfolio");
let withdrawals: typeof import("@/lib/withdrawals");
let pay: typeof import("@/lib/payments/test-payment");
let admin: typeof import("@/lib/admin/service");
const actor = { id: "admin-test", name: "Admin de prueba" };
const BANK = { bank: "Bancolombia", accountType: "ahorros", accountNumber: "123-456789-01" };

/** El reloj de las pruebas: el plan se paga un 10 de noviembre a las 12:30 p. m. (mitad del día solar). */
const T0 = bogotaMs(2026, 11, 10, 12, 30);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  portfolio = await import("@/lib/portfolio");
  withdrawals = await import("@/lib/withdrawals");
  pay = await import("@/lib/payments/test-payment");
  admin = await import("@/lib/admin/service");
  for (const id of ["c1", "c2", "c3", "c4", "c5"]) await createUser(id);
  await createUser("sin-datos", { profile: false });
  for (const id of ["c1", "c2", "c3", "c4"]) await pay.payWithTestPayment({ userId: id, planId: "p180" });
}, 120_000);

afterEach(() => {
  vi.stubEnv("DEMO_MODE", "");
});
afterAll(() => {
  vi.useRealTimers();
});

describe("energía y saldo de un plan", () => {
  it("recién pagado: el plan está activo y todavía no ha generado", async () => {
    const p = await portfolio.getPortfolio("c1");
    expect(p.subscriptions).toHaveLength(1);
    expect(p.subscriptions[0]).toMatchObject({ planName: "Plan 180", state: "activa", paidMonths: 1, months: 3, monthlyCop: 20_880_000, dailyKwh: 2000, priceCopPerKwh: 348, saleCopPerKwh: 400 });
    expect(p.subscriptions[0].paidUntil).toBe(T0 + 30 * DAY_MS);
    expect(p).toMatchObject({ generatedKwh: 0, soldCop: 0, balanceCop: 0, dailyKwh: 2000, dailyProfitCop: 104_000 });
    expect(p.transactions[0]).toMatchObject({ kind: "plan_mes", status: "confirmada", method: "demo", amountCop: 20_880_000, kwh: 60_000, periodIndex: 1 });
  });

  it("diez días después: 20.000 kWh vendidos a $ 400, con utilidad de $ 52 por kWh", async () => {
    vi.setSystemTime(T0 + 10 * DAY_MS);
    const p = await portfolio.getPortfolio("c1");
    expect(p.generatedKwh).toBeCloseTo(20_000, 4);
    expect(p.soldCop).toBeCloseTo(8_000_000, 0);
    expect(p.costCop).toBeCloseTo(6_960_000, 0);
    expect(p.profitCop).toBeCloseTo(1_040_000, 0);
    // A las 12:30 va la mitad de la energía del día.
    expect(p.todayKwh).toBeCloseTo(1000, 4);
    expect(p.balanceCop).toBe(8_000_000);
  });

  it("al terminar el mes sin pagar el siguiente, la energía se pausa y el saldo deja de crecer", async () => {
    vi.setSystemTime(T0 + 33 * DAY_MS);
    const p = await portfolio.getPortfolio("c1");
    expect(p.subscriptions[0]).toMatchObject({ state: "en_pausa", graceEndsAt: T0 + 45 * DAY_MS });
    expect(p.generatedKwh).toBeCloseTo(60_000, 4);
    expect(p.dailyKwh).toBe(0);
    vi.setSystemTime(T0 + 10 * DAY_MS);
  });
});

describe("retiros", () => {
  it("a una cuenta bancaria: queda en revisión y aparta el saldo", async () => {
    const w = await withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 3_000_000.9, destination: BANK });
    expect(w).toMatchObject({ kind: "retiro", status: "por_aprobar", amountCop: 3_000_000, asset: "COP", bankName: "Bancolombia", bankAccountType: "ahorros", bankAccountLast4: "8901" });
    expect(await portfolio.getPortfolio("c1")).toMatchObject({ reservedCop: 3_000_000, balanceCop: 5_000_000 });
  });

  it("no deja retirar más que el saldo, ni menos que el mínimo", async () => {
    await expect(withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 5_000_001, destination: BANK })).rejects.toThrow(/saldo suficiente/);
    await expect(withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 10_000, destination: BANK })).rejects.toThrow(/mínimo/);
  });

  it("valida la cuenta bancaria e indica el campo", async () => {
    await expect(withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 100_000, destination: { ...BANK, accountNumber: "12" } })).rejects.toMatchObject({ status: 400, extra: { fields: { accountNumber: expect.any(String) } } });
    await expect(withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 100_000, destination: { ...BANK, bank: "Banco Inventado" } })).rejects.toMatchObject({ status: 400 });
  });

  it("dos retiros simultáneos no pueden gastar el mismo saldo", async () => {
    // c2 tiene $ 8.000.000: dos retiros de 5 millones a la vez, solo uno puede pasar.
    const results = await Promise.allSettled([
      withdrawals.createBankWithdrawal({ userId: "c2", amountCop: 5_000_000, destination: BANK }),
      withdrawals.createBankWithdrawal({ userId: "c2", amountCop: 5_000_000, destination: BANK }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await portfolio.getPortfolio("c2")).balanceCop).toBe(3_000_000);
  });

  it("a una wallet: hay que firmar con la wallet de destino", async () => {
    const acct = privateKeyToAccount(generatePrivateKey());
    const other = privateKeyToAccount(generatePrivateKey());
    const w = await withdrawals.createWalletWithdrawal({ userId: "c3", amountCop: 1_000_000, walletAddress: acct.address, walletName: "Trust Wallet", chainId: 56 });
    expect(w.message).toContain(acct.address);
    await expect(withdrawals.confirmWalletWithdrawal("c3", w.withdrawalId, await other.signMessage({ message: w.message }))).rejects.toThrow(/firma/);
    // Sin firma válida todavía no aparta saldo.
    expect((await portfolio.getPortfolio("c3")).reservedCop).toBe(0);
    const ok = await withdrawals.confirmWalletWithdrawal("c3", w.withdrawalId, await acct.signMessage({ message: w.message }));
    expect(ok).toMatchObject({ status: "por_aprobar", asset: "USDT", walletAddress: acct.address });
    expect((await portfolio.getPortfolio("c3")).reservedCop).toBe(1_000_000);
    // Confirmar dos veces no aparta dos veces.
    await withdrawals.confirmWalletWithdrawal("c3", w.withdrawalId, await acct.signMessage({ message: w.message }));
    expect((await portfolio.getPortfolio("c3")).reservedCop).toBe(1_000_000);
  });

  it("el retiro de otra empresa no se puede consultar ni confirmar", async () => {
    const w = await withdrawals.createBankWithdrawal({ userId: "c3", amountCop: 100_000, destination: BANK });
    await expect(withdrawals.getWithdrawal("c4", w.id)).rejects.toMatchObject({ status: 404 });
  });

  it("sin los datos de la empresa no se puede retirar", async () => {
    await expect(withdrawals.createBankWithdrawal({ userId: "sin-datos", amountCop: 100_000, destination: BANK })).rejects.toMatchObject({ status: 412 });
  });

  it("al aprobar pasa a retirado; al rechazar, el saldo vuelve", async () => {
    const a = await withdrawals.createBankWithdrawal({ userId: "c4", amountCop: 2_000_000, destination: BANK });
    const b = await withdrawals.createBankWithdrawal({ userId: "c4", amountCop: 1_000_000, destination: BANK });
    await admin.decideWithdrawal(actor, a.id, "aprobar", "", "COMPROBANTE-778899");
    await admin.decideWithdrawal(actor, b.id, "rechazar", "La cuenta no está a nombre de la empresa");
    const p = await portfolio.getPortfolio("c4");
    expect(p).toMatchObject({ withdrawnCop: 2_000_000, reservedCop: 0, balanceCop: 6_000_000 });
    expect(p.transactions.find((t) => t.id === a.id)).toMatchObject({ status: "confirmada", txHash: "COMPROBANTE-778899" });
    expect(p.transactions.find((t) => t.id === b.id)).toMatchObject({ status: "rechazada", note: expect.stringMatching(/nombre de la empresa/) });
  });

  it("con dinero real, aprobar exige la referencia del envío", async () => {
    const w = await withdrawals.createBankWithdrawal({ userId: "c4", amountCop: 500_000, destination: BANK });
    vi.stubEnv("DEMO_MODE", "false");
    await expect(admin.decideWithdrawal(actor, w.id, "aprobar")).rejects.toThrow(/referencia/i);
    await expect(admin.decideWithdrawal(actor, w.id, "aprobar", "", "TRX-20261120-01")).resolves.toMatchObject({ status: "confirmada" });
  });

  it("el admin ve la cuenta completa y la empresa; el usuario solo los últimos 4 dígitos", async () => {
    const list = await admin.listWithdrawals();
    const row = list.find((w) => w.userId === "c1");
    expect(row).toMatchObject({ bankAccountNumber: "12345678901", bankAccountLast4: "8901", companyName: "Empresa c1", nit: "900123456-8" });
  });
});

describe("pago de prueba", () => {
  it("solo existe en modo de pruebas", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    await expect(pay.payWithTestPayment({ userId: "c5", planId: "p180" })).rejects.toMatchObject({ status: 403 });
  });

  it("exige los datos de la empresa", async () => {
    await expect(pay.payWithTestPayment({ userId: "sin-datos", planId: "p180" })).rejects.toMatchObject({ status: 412 });
  });

  it("rechaza un plan que no existe", async () => {
    await expect(pay.payWithTestPayment({ userId: "c5", planId: "p999" })).rejects.toThrow(/planes disponibles/);
  });
});
