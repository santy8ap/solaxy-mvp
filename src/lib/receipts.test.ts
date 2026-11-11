import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../tests/helpers";

const testDir = mkdtempSync(path.join(tmpdir(), "xge-receipts-"));
process.env.DATABASE_URL = `file:${path.join(testDir, "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let receipts: typeof import("@/lib/receipts");
let pay: typeof import("@/lib/payments/test-payment");
let dbModule: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let orderId: string;

beforeAll(async () => {
  receipts = await import("@/lib/receipts");
  pay = await import("@/lib/payments/test-payment");
  dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  await createUser("receipt-owner", { profile: false });
  const { saveProfile } = await import("@/lib/profile");
  await saveProfile("receipt-owner", {
    fullName: "Mariana Gómez Restrepo",
    docType: "CC",
    docNumber: "1036123456",
    phone: "3001234567",
    city: "Medellín",
    acceptTerms: true,
  });
  const result = await pay.payWithTestPayment({
    userId: "receipt-owner",
    planId: "p180",
  });
  orderId = result.order.id;
}, 120000);

describe("comprobantes del titular", () => {
  it("usa los precios del contrato y avisa si no hubo dinero real", async () => {
    const receipt = await receipts.receiptData("receipt-owner", orderId);
    expect(receipt).toMatchObject({
      holder: "Mariana Gómez Restrepo",
      amountCop: 20880000,
      priceCopPerKwh: 348,
      saleCopPerKwh: 400,
      kwh: 60000,
      test: true,
    });
  });
  it("rechaza movimientos ajenos y comprobantes de pagos pendientes", async () => {
    await expect(
      receipts.receiptData("another-user", orderId),
    ).rejects.toMatchObject({ status: 404 });
    await dbModule.db
      .insert(schema.ledgerTx)
      .values({
        id: "IWE-PENDING-RECEIPT",
        userId: "receipt-owner",
        kind: "plan_mes",
        status: "pendiente",
        amountCop: 20880000,
        createdAt: Date.now(),
        method: "mercadopago",
      });
    await expect(
      receipts.receiptData("receipt-owner", "IWE-PENDING-RECEIPT"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("genera un PDF válido con tildes y referencia real de la operación", async () => {
    const bytes = await receipts.renderReceipt(
      await receipts.receiptData("receipt-owner", orderId),
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    if (process.env.XGE_RECEIPT_PREVIEW)
      writeFileSync(process.env.XGE_RECEIPT_PREVIEW, bytes);
  });
  it("no crea una orden cuando el usuario revisó un importe que ya cambió", async () => {
    await expect(
      pay.payWithTestPayment({
        userId: "receipt-owner",
        planId: "p180",
        expectedAmountCop: 1000000,
        expectedSaleCopPerKwh: 400,
      }),
    ).rejects.toMatchObject({
      status: 409,
      extra: { code: "precio_actualizado" },
    });
    const { eq } = await import("drizzle-orm");
    const rows = await dbModule.db
      .select()
      .from(schema.ledgerTx)
      .where(eq(schema.ledgerTx.userId, "receipt-owner"));
    expect(rows).toHaveLength(2);
  });
});
