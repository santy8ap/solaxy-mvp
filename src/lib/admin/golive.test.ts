import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-golive-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let status: typeof import("@/lib/admin/config-status");
let reset: typeof import("@/lib/admin/demo-reset");
let profile: typeof import("@/lib/profile");
let pay: typeof import("@/lib/payments/test-payment");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const actor = { id: "admin-test", name: "Admin de prueba" };
const PHRASE = "BORRAR DATOS DE PRUEBA";
const byId = async (opts?: { probes?: boolean }) => Object.fromEntries((await status.configStatus(opts)).checks.map((c) => [c.id, c]));

beforeAll(async () => {
  status = await import("@/lib/admin/config-status");
  reset = await import("@/lib/admin/demo-reset");
  profile = await import("@/lib/profile");
  pay = await import("@/lib/payments/test-payment");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  await createUser("real-1", { name: "Socia Real S.A.S." });
  await dbMod.db.insert(schema.account).values({ id: "acc-1", accountId: "g-1", providerId: "google", userId: "real-1", createdAt: new Date(), updatedAt: new Date() });
}, 120_000);

afterEach(() => {
  for (const k of ["DEMO_MODE", "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "CRYPTO_TREASURY_ADDRESS", "CRYPTO_NETWORK", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_PIN", "ADMIN_EMAILS", "TURSO_DATABASE_URL", "VERCEL"]) {
    vi.stubEnv(k, "");
  }
});

describe("lista de configuración", () => {
  it("dice qué falta, con el nombre exacto de cada variable", async () => {
    const s = await status.configStatus();
    const checks = Object.fromEntries(s.checks.map((c) => [c.id, c]));
    expect(checks["mp-token"]).toMatchObject({ state: "falta", vars: ["MERCADOPAGO_ACCESS_TOKEN"] });
    expect(checks["mp-webhook"]).toMatchObject({ state: "falta", vars: ["MERCADOPAGO_WEBHOOK_SECRET"] });
    expect(checks["cripto-billetera"]).toMatchObject({ state: "falta", vars: ["CRYPTO_TREASURY_ADDRESS"] });
    expect(checks["google"]).toMatchObject({ state: "falta", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] });
    expect(s.readyForLive).toBe(false);
    expect(s.webhookUrl).toMatch(/\/api\/webhooks\/mercadopago$/);
  });

  it("marca como listo lo que está configurado y avisa si las credenciales de Mercado Pago son de prueba", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-123-abc");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "clave-secreta");
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    const checks = await byId();
    expect(checks["mp-token"].state).toBe("aviso");
    expect(checks["mp-webhook"].state).toBe("ok");
    expect(checks["cripto-billetera"].state).toBe("ok");
  });

  it("reconoce las credenciales de prueba nuevas (APP_USR- de una cuenta de prueba): aviso en pruebas, bloqueo con dinero real", async () => {
    delete (globalThis as { __solaxyMpAccount?: unknown }).__solaxyMpAccount;
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ site_id: "MCO", nickname: "TESTUSER1", tags: ["test_user"] })));
    try {
      expect((await byId())["mp-token"]).toMatchObject({ state: "aviso", detail: expect.stringMatching(/prueba/) });
      vi.stubEnv("DEMO_MODE", "false");
      expect((await byId())["mp-token"].state).toBe("falta");
    } finally {
      vi.unstubAllGlobals();
      delete (globalThis as { __solaxyMpAccount?: unknown }).__solaxyMpAccount;
    }
  });

  it("la red de pruebas de cripto es un aviso en pruebas y un bloqueo con dinero real", async () => {
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    vi.stubEnv("CRYPTO_NETWORK", "bsc-testnet");
    expect((await byId())["cripto-red"].state).toBe("aviso");
    vi.stubEnv("DEMO_MODE", "false");
    expect((await byId())["cripto-red"].state).toBe("falta");
  });

  it("sin datos de prueba no hay nada que borrar", async () => {
    expect((await byId())["datos-prueba"]).toMatchObject({ state: "ok" });
  });

  it("con dinero real, los pagos de prueba que quedan bloquean la salida en vivo", async () => {
    await pay.payWithTestPayment({ userId: "real-1", planId: "p180" });
    expect((await byId())["datos-prueba"].state).toBe("info");
    vi.stubEnv("DEMO_MODE", "false");
    expect((await byId())["datos-prueba"]).toMatchObject({ state: "falta", action: "borrar_datos_prueba", detail: expect.stringMatching(/1 pagos de prueba/) });
  });
});

describe("borrar los datos de prueba", () => {
  it("no se puede en modo de pruebas", async () => {
    await expect(reset.resetDemoData(actor, PHRASE)).rejects.toMatchObject({ status: 409 });
  });

  it("pide escribir la frase de confirmación", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    await expect(reset.resetDemoData(actor, "borrar")).rejects.toMatchObject({ status: 400 });
  });

  it("no se puede si ya hay pagos reales", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const { db } = dbMod;
    await db.insert(schema.ledgerTx).values({ id: "SLX-REAL000001", userId: "real-1", kind: "plan_mes", status: "confirmada", amountCop: 20_880_000, createdAt: Date.now(), method: "manual", providerId: "TRANSF-REAL-1" });
    await expect(reset.resetDemoData(actor, PHRASE)).rejects.toMatchObject({ status: 409 });
    await db.delete(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.id, "SLX-REAL000001"));
  });

  it("borra la cuenta de pruebas, los planes y los movimientos, y conserva las cuentas reales con los datos de su empresa", async () => {
    const { db } = dbMod;
    const now = new Date();
    await db.insert(schema.user).values({ id: "demo-1", name: "Empresa de Pruebas", email: "demo@solaxy.local", emailVerified: true, createdAt: now, updatedAt: now });
    await profile.saveProfile("demo-1", { companyName: "Empresa de Pruebas", nit: "900123456-8", fullName: "Persona Demo", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true });
    await pay.payWithTestPayment({ userId: "demo-1", planId: "p360" });
    vi.stubEnv("DEMO_MODE", "false");

    const r = await reset.resetDemoData(actor, PHRASE);
    expect(r).toMatchObject({ deletedUsers: 1, deletedPlans: 2, deletedTx: 2 });
    expect((await db.select().from(schema.user)).map((u) => u.id)).toEqual(["real-1"]);
    expect(await db.select().from(schema.ledgerTx)).toHaveLength(0);
    expect(await db.select().from(schema.planSubscription)).toHaveLength(0);
    expect(await db.select().from(schema.planPeriod)).toHaveLength(0);
    expect(await profile.getProfile("real-1")).toMatchObject({ companyName: "Socia Real S.A.S.", complete: true });
    expect(await profile.getProfile("demo-1")).toBeNull();
    expect((await byId())["datos-prueba"].state).toBe("ok");
  });
});
