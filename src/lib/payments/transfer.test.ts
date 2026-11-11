import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-transfer-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let transfer: typeof import("@/lib/payments/transfer");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
let payments: typeof import("@/lib/admin/payments");
const admin = { id: "admin-1", name: "Admin de prueba" };
const ACCOUNT = { bank: "Bancolombia", accountType: "corriente", accountNumber: "123-456789-01", holder: "X green Energy S.A.S.", holderId: "901234567-1" };
const MONTH_180 = 20_880_000;

afterEach(() => vi.stubEnv("DEMO_MODE", ""));

beforeAll(async () => {
  transfer = await import("@/lib/payments/transfer");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  payments = await import("@/lib/admin/payments");
  await createUser("t1");
  await createUser("t2");
  await createUser("t3", { profile: false });
}, 120_000);

const periodsOf = async (txId: string) => dbMod.db.select().from(schema.planPeriod).where(drizzle.eq(schema.planPeriod.txId, txId));

describe("datos de la cuenta para transferencias", () => {
  it("sin datos guardados, la transferencia no está disponible", async () => {
    expect(await transfer.getTransferAccount()).toBeNull();
    await expect(transfer.transferInstructions({ userId: "t1", planId: "p180" })).rejects.toMatchObject({ status: 503 });
    await expect(transfer.reportTransfer({ userId: "t1", planId: "p180", receipt: "COMP-1001" })).rejects.toMatchObject({ status: 503 });
  });

  it("el admin guarda la cuenta; el número queda solo con dígitos", async () => {
    const saved = await transfer.saveTransferAccount(admin, ACCOUNT);
    expect(saved).toMatchObject({ bank: "Bancolombia", accountType: "corriente", accountNumber: "12345678901", holder: "X green Energy S.A.S." });
    expect(await transfer.getTransferAccount()).toMatchObject({ accountNumber: "12345678901" });
    const [log] = await dbMod.db.select().from(schema.adminAudit).where(drizzle.eq(schema.adminAudit.action, "config_transferencia"));
    expect(log).toBeTruthy();
  });

  it("rechaza datos inválidos", async () => {
    await expect(transfer.saveTransferAccount(admin, { ...ACCOUNT, bank: "Banco Inventado" })).rejects.toThrow();
    await expect(transfer.saveTransferAccount(admin, { ...ACCOUNT, accountNumber: "12" })).rejects.toThrow();
    await expect(transfer.saveTransferAccount(admin, { ...ACCOUNT, holder: "<b>Empresa</b>" })).rejects.toThrow();
  });
});

describe("la empresa ve los datos y reporta su transferencia", () => {
  it("ve la cuenta, el valor exacto y la referencia del plan y el mes, sin crear ninguna orden", async () => {
    const before = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.userId, "t1"));
    const info = await transfer.transferInstructions({ userId: "t1", planId: "p180" });
    expect(info).toMatchObject({ amountCop: MONTH_180, periodIndex: 1, order: null, account: { bank: "Bancolombia", accountNumber: "12345678901" } });
    expect(info.reference).toMatch(/^PLN-[0-9A-F]{8}-M1$/);
    const after = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.userId, "t1"));
    expect(after).toHaveLength(before.length);
  });

  it("al reportar, la orden queda por verificar con el monto del servidor y el comprobante, sin activar nada", async () => {
    const r = await transfer.reportTransfer({ userId: "t1", planId: "p180", receipt: " COMP-2001 " });
    expect(r.created).toBe(true);
    expect(r.order).toMatchObject({ status: "verificando", method: "transferencia", amountCop: MONTH_180, periodIndex: 1, txHash: "COMP-2001", providerStatus: transfer.REPORTED_STATUS });
    expect(await periodsOf(r.order.id)).toHaveLength(0);
    // La referencia que vio la empresa es la del plan y el mes de la orden.
    const info = await transfer.transferInstructions({ userId: "t1", planId: "p180" });
    expect(info.reference).toBe(transfer.transferReference(r.order.subscriptionId!, 1));
    expect(info.order?.id).toBe(r.order.id);
  });

  it("reportar el mismo mes otra vez devuelve la misma orden (no duplica)", async () => {
    const a = await transfer.reportTransfer({ userId: "t1", planId: "p180", receipt: "COMP-2001" });
    const b = await transfer.reportTransfer({ userId: "t1", planId: "p180", receipt: "COMP-2002" });
    expect(b).toMatchObject({ created: false, order: { id: a.order.id, txHash: "COMP-2001" } });
  });

  it("el comprobante es obligatorio y no acepta HTML", async () => {
    await expect(transfer.reportTransfer({ userId: "t2", planId: "p180", receipt: "" })).rejects.toThrow();
    await expect(transfer.reportTransfer({ userId: "t2", planId: "p180", receipt: "<script>x</script>" })).rejects.toThrow();
  });

  it("sin datos personales completos no se puede", async () => {
    await expect(transfer.transferInstructions({ userId: "t3", planId: "p180" })).rejects.toMatchObject({ status: 412 });
    await expect(transfer.reportTransfer({ userId: "t3", planId: "p180", receipt: "COMP-3001" })).rejects.toMatchObject({ status: 412 });
  });

  it("si el precio cambió desde el resumen, pide revisar de nuevo", async () => {
    await expect(transfer.transferInstructions({ userId: "t2", planId: "p180", expectedAmountCop: 1 })).rejects.toMatchObject({ status: 409 });
    await expect(transfer.reportTransfer({ userId: "t2", planId: "p180", receipt: "COMP-4001", expectedAmountCop: 1 })).rejects.toMatchObject({ status: 409 });
  });

  it("no se puede pagar el plan de otra empresa", async () => {
    const { order } = await transfer.reportTransfer({ userId: "t1", planId: "p180", receipt: "COMP-2001" });
    await expect(transfer.transferInstructions({ userId: "t2", subscriptionId: order.subscriptionId! })).rejects.toMatchObject({ status: 404 });
    await expect(transfer.reportTransfer({ userId: "t2", subscriptionId: order.subscriptionId!, receipt: "COMP-9001" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("el admin confirma o rechaza", () => {
  it("confirmar activa el mes con la referencia del banco, una sola vez", async () => {
    const { order } = await transfer.reportTransfer({ userId: "t1", planId: "p180", receipt: "COMP-2001" });
    const done = await transfer.confirmTransfer(admin, order.id, "BANCO-REF-77001");
    expect(done).toMatchObject({ status: "confirmada" });
    expect(await periodsOf(order.id)).toHaveLength(1);
    await expect(transfer.confirmTransfer(admin, order.id, "BANCO-REF-77001")).rejects.toMatchObject({ status: 409 });
    const [log] = await dbMod.db.select().from(schema.adminAudit).where(drizzle.eq(schema.adminAudit.action, "confirmar_transferencia"));
    expect(log?.targetUserId).toBe("t1");
  });

  it("la misma referencia del banco no sirve para confirmar otro pago", async () => {
    const { order } = await transfer.reportTransfer({ userId: "t2", planId: "p360", receipt: "COMP-5001" });
    await expect(transfer.confirmTransfer(admin, order.id, "BANCO-REF-77001")).rejects.toMatchObject({ status: 409 });
    expect(await periodsOf(order.id)).toHaveLength(0);
  });

  it("rechazar cierra la orden con el motivo y no activa nada", async () => {
    const { order } = await transfer.reportTransfer({ userId: "t2", planId: "p360", receipt: "COMP-5001" });
    const closed = await transfer.rejectTransfer(admin, order.id, "No llegó a la cuenta");
    expect(closed).toMatchObject({ status: "fallida" });
    expect(closed.note).toMatch(/No llegó a la cuenta/);
    expect(closed.txHash).toBe("COMP-5001");
    expect(await periodsOf(order.id)).toHaveLength(0);
    await expect(transfer.confirmTransfer(admin, order.id, "BANCO-REF-77002")).rejects.toMatchObject({ status: 409 });
  });

  it("solo se confirman transferencias", async () => {
    await expect(transfer.confirmTransfer(admin, "IWE-NOEXISTE0", "BANCO-REF-1")).rejects.toMatchObject({ status: 404 });
  });

  it("con dinero real, una transferencia confirmada cuenta como recaudo", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const before = await payments.paymentSummary();
    const { order } = await transfer.reportTransfer({ userId: "t2", planId: "p180", receipt: "COMP-6001" });
    await transfer.confirmTransfer(admin, order.id, "BANCO-REF-88001");
    expect((await payments.paymentSummary()).totalCop).toBe(before.totalCop + MONTH_180);
  });
});
