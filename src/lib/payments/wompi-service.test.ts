import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { WompiEvent, WompiTransaction } from "@/lib/payments/wompi";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-wompi-")), "test.db")}`;
const INTEGRITY = "test_integrity_secreto";
const EVENTS = "test_events_secreto";
vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_llave");
vi.stubEnv("WOMPI_INTEGRITY_SECRET", INTEGRITY);
vi.stubEnv("WOMPI_EVENTS_SECRET", EVENTS);
vi.stubEnv("WOMPI_API_BASE", "https://wompi.falso/v1");

let svc: typeof import("@/lib/payments/wompi-service");
let profile: typeof import("@/lib/profile");
let market: typeof import("@/lib/market");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

/** Wompi falso: guarda transacciones y responde GET /transactions/{id}. */
const wompi = new Map<string, WompiTransaction>();
const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  const id = decodeURIComponent(url.split("/transactions/")[1] ?? "");
  if (!url.startsWith("https://wompi.falso/v1/transactions/")) return new Response("{}", { status: 400 });
  const tx = wompi.get(id);
  return new Response(JSON.stringify(tx ? { data: tx } : { error: { type: "NOT_FOUND_ERROR" } }), { status: tx ? 200 : 404 });
}) as typeof fetch;

let seq = 0;
function payment(reference: string, amountInCents: number, status: string, extra: Partial<WompiTransaction> = {}) {
  const tx: WompiTransaction = { id: `1234-${Date.now()}-${++seq}`, status, reference, amount_in_cents: amountInCents, currency: "COP", payment_method_type: "CARD", ...extra };
  wompi.set(tx.id, tx);
  return tx;
}

function signedEvent(tx: WompiTransaction, secret = EVENTS): WompiEvent {
  const timestamp = Math.floor(Date.now() / 1000);
  const checksum = createHash("sha256").update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${secret}`).digest("hex");
  return { event: "transaction.updated", data: { transaction: tx }, signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum }, timestamp };
}

const PROFILE = { fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true };

async function entriesOf(orderId: string) {
  return dbMod.db.select().from(schema.positionEntry).where(drizzle.eq(schema.positionEntry.txId, orderId));
}
async function orderRow(orderId: string) {
  const [row] = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.id, orderId));
  return row;
}

beforeAll(async () => {
  svc = await import("@/lib/payments/wompi-service");
  profile = await import("@/lib/profile");
  market = await import("@/lib/market");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
  for (const u of ["inv-030", "inv-031", "inv-032", "inv-033", "inv-034", "inv-035", "inv-036", "inv-037"]) await profile.saveProfile(u, PROFILE);
}, 120_000);

describe("orden con Wompi", () => {
  it("sin datos de inversionista no se puede pagar", async () => {
    await expect(svc.createWompiOrder({ userId: "inv-040", email: "x@y.co", kw: 1 })).rejects.toMatchObject({ status: 412 });
  });

  it("crea la orden pendiente y una URL de checkout con la firma calculada en el servidor", async () => {
    const o = await svc.createWompiOrder({ userId: "inv-030", email: "laura@correo.co", kw: 1.5 });
    const row = await orderRow(o.orderId);
    expect(row).toMatchObject({ status: "pendiente", method: "wompi", kind: "compra", kw: 1.5 });
    const cents = row.amountCop * 100;
    expect(row.expectedAmount).toBe(String(cents));
    const url = new URL(o.checkoutUrl);
    const expected = createHash("sha256").update(`${o.orderId}${cents}COP${INTEGRITY}`).digest("hex");
    expect(url.searchParams.get("signature:integrity")).toBe(expected);
    expect(url.searchParams.get("reference")).toBe(o.orderId);
    expect(url.searchParams.get("redirect-url")).toMatch(/\/pagos\/resultado$/);
    expect(url.searchParams.get("customer-data:legal-id")).toBe("1036123456");
  });
});

describe("confirmación del pago", () => {
  it("APPROVED asigna los kW una sola vez, aunque lleguen el webhook y la consulta a la vez", async () => {
    const o = await svc.createWompiOrder({ userId: "inv-031", email: "a@b.co", kw: 1 });
    const tx = payment(o.orderId, Number((await orderRow(o.orderId)).expectedAmount), "APPROVED");
    await Promise.all([
      svc.syncWompiTransaction(tx.id, { fetch: fakeFetch }),
      svc.handleWompiEvent(signedEvent(tx)),
      svc.handleWompiEvent(signedEvent(tx)),
      svc.syncWompiTransaction(tx.id, { fetch: fakeFetch }),
    ]);
    expect(await entriesOf(o.orderId)).toHaveLength(1);
    const row = await orderRow(o.orderId);
    expect(row).toMatchObject({ status: "confirmada", providerId: tx.id, providerStatus: "APPROVED" });
    const again = await svc.syncWompiTransaction(tx.id, { fetch: fakeFetch });
    expect(again?.order.status).toBe("confirmada");
    expect(await entriesOf(o.orderId)).toHaveLength(1);
  });

  it("DECLINED deja la orden fallida con el motivo", async () => {
    const o = await svc.createWompiOrder({ userId: "inv-032", email: "a@b.co", kw: 0.5 });
    const tx = payment(o.orderId, Number((await orderRow(o.orderId)).expectedAmount), "DECLINED", { status_message: "Fondos insuficientes" });
    const r = await svc.syncWompiTransaction(tx.id, { fetch: fakeFetch });
    expect(r?.order.status).toBe("fallida");
    expect(r?.order.note).toMatch(/Fondos insuficientes/);
    expect(await entriesOf(o.orderId)).toHaveLength(0);
  });

  it("PENDING (PSE) queda en proceso y luego se aprueba por webhook", async () => {
    const o = await svc.createWompiOrder({ userId: "inv-033", email: "a@b.co", kw: 0.5 });
    const cents = Number((await orderRow(o.orderId)).expectedAmount);
    const tx = payment(o.orderId, cents, "PENDING", { payment_method_type: "PSE" });
    const r = await svc.syncWompiTransaction(tx.id, { fetch: fakeFetch });
    expect(r?.order.status).toBe("pendiente");
    expect((await orderRow(o.orderId)).providerStatus).toBe("PENDING");
    const res = await svc.handleWompiEvent(signedEvent({ ...tx, status: "APPROVED" }));
    expect(res.status).toBe(200);
    expect((await orderRow(o.orderId)).status).toBe("confirmada");
    expect(await entriesOf(o.orderId)).toHaveLength(1);
  });

  it("si el monto no coincide con la orden, no asigna kW y queda por reembolsar", async () => {
    const o = await svc.createWompiOrder({ userId: "inv-034", email: "a@b.co", kw: 1 });
    const tx = payment(o.orderId, 100, "APPROVED");
    const r = await svc.syncWompiTransaction(tx.id, { fetch: fakeFetch });
    expect(r?.order.status).toBe("por_reembolsar");
    expect(await entriesOf(o.orderId)).toHaveLength(0);
  });

  it("rechaza un webhook con checksum inválido sin tocar la orden", async () => {
    const o = await svc.createWompiOrder({ userId: "inv-035", email: "a@b.co", kw: 1 });
    const tx = payment(o.orderId, Number((await orderRow(o.orderId)).expectedAmount), "APPROVED");
    const res = await svc.handleWompiEvent(signedEvent(tx, "secreto-equivocado"));
    expect(res.status).toBe(401);
    expect((await orderRow(o.orderId)).status).toBe("pendiente");
  });

  it("una transacción con una referencia desconocida no hace nada", async () => {
    const tx = payment("SLX-NOEXISTE", 1000, "APPROVED");
    expect(await svc.syncWompiTransaction(tx.id, { fetch: fakeFetch })).toBeNull();
    expect((await svc.handleWompiEvent(signedEvent(tx))).status).toBe(200);
  });
});

describe("compra P2P con Wompi", () => {
  it("mientras alguien paga una oferta, nadie más puede empezar a pagarla", async () => {
    const l = await market.createListing("inv-001", 0.5, 4_800_000);
    await svc.createWompiOrder({ userId: "inv-036", email: "a@b.co", listingId: l.id });
    await expect(svc.createWompiOrder({ userId: "inv-037", email: "b@c.co", listingId: l.id })).rejects.toMatchObject({ status: 409 });
  });

  it("si la oferta ya no está cuando llega el pago, queda por reembolsar y el vendedor conserva sus kW", async () => {
    const l = await market.createListing("inv-002", 0.5, 4_800_000);
    const o = await svc.createWompiOrder({ userId: "inv-037", email: "b@c.co", listingId: l.id });
    await market.cancelListing("inv-002", l.id);
    const tx = payment(o.orderId, Number((await orderRow(o.orderId)).expectedAmount), "APPROVED");
    const r = await svc.syncWompiTransaction(tx.id, { fetch: fakeFetch });
    expect(r?.order.status).toBe("por_reembolsar");
    expect(await entriesOf(o.orderId)).toHaveLength(0);
  });
});
