import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-golive-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let status: typeof import("@/lib/admin/config-status");
let reset: typeof import("@/lib/admin/demo-reset");
let profile: typeof import("@/lib/profile");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const actor = { id: "admin-test", name: "Admin de prueba" };
const PHRASE = "BORRAR DATOS DEMO";

beforeAll(async () => {
  status = await import("@/lib/admin/config-status");
  reset = await import("@/lib/admin/demo-reset");
  profile = await import("@/lib/profile");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
}, 120_000);

afterEach(() => {
  for (const k of ["DEMO_MODE", "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "CRYPTO_TREASURY_ADDRESS", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_PIN", "ADMIN_EMAILS", "TURSO_DATABASE_URL", "VERCEL"]) {
    vi.stubEnv(k, "");
  }
});

describe("lista de configuración", () => {
  it("dice qué falta, con el nombre exacto de cada variable", async () => {
    const s = await status.configStatus();
    const byId = Object.fromEntries(s.checks.map((c) => [c.id, c]));
    expect(byId["mp-token"]).toMatchObject({ state: "falta", vars: ["MERCADOPAGO_ACCESS_TOKEN"] });
    expect(byId["mp-webhook"]).toMatchObject({ state: "falta", vars: ["MERCADOPAGO_WEBHOOK_SECRET"] });
    expect(byId["cripto-billetera"]).toMatchObject({ state: "falta", vars: ["CRYPTO_TREASURY_ADDRESS"] });
    expect(byId["google"]).toMatchObject({ state: "falta", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] });
    expect(s.readyForLive).toBe(false);
    expect(s.webhookUrl).toMatch(/\/api\/webhooks\/mercadopago$/);
  });

  it("marca como listo lo que está configurado y avisa si las credenciales de Mercado Pago son de prueba", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-123-abc");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "clave-secreta");
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    const byId = Object.fromEntries((await status.configStatus()).checks.map((c) => [c.id, c]));
    expect(byId["mp-token"].state).toBe("aviso");
    expect(byId["mp-webhook"].state).toBe("ok");
    expect(byId["cripto-billetera"].state).toBe("ok");
  });

  it("reconoce las credenciales de prueba nuevas (APP_USR- de una cuenta de prueba): aviso en demo, bloqueo con dinero real", async () => {
    delete (globalThis as { __solaxyMpAccount?: unknown }).__solaxyMpAccount;
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ site_id: "MCO", nickname: "TESTUSER1", tags: ["test_user"] })));
    try {
      let byId = Object.fromEntries((await status.configStatus()).checks.map((c) => [c.id, c]));
      expect(byId["mp-token"]).toMatchObject({ state: "aviso" });
      expect(byId["mp-token"].detail).toMatch(/prueba/);
      vi.stubEnv("DEMO_MODE", "false");
      byId = Object.fromEntries((await status.configStatus()).checks.map((c) => [c.id, c]));
      expect(byId["mp-token"].state).toBe("falta");
    } finally {
      vi.unstubAllGlobals();
      delete (globalThis as { __solaxyMpAccount?: unknown }).__solaxyMpAccount;
    }
  });

  it("con dinero real, los datos de demostración que quedan bloquean la salida en vivo", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const byId = Object.fromEntries((await status.configStatus()).checks.map((c) => [c.id, c]));
    expect(byId["datos-demo"]).toMatchObject({ state: "falta", action: "borrar_datos_demo" });
  });
});

describe("borrar los datos de demostración", () => {
  it("no se puede en modo demo", async () => {
    await expect(reset.resetDemoData(actor, PHRASE)).rejects.toMatchObject({ status: 409 });
  });

  it("pide escribir la frase de confirmación", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    await expect(reset.resetDemoData(actor, "borrar")).rejects.toMatchObject({ status: 400 });
  });

  it("no se puede si ya hay pagos reales", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const { db } = dbMod;
    await db.insert(schema.ledgerTx).values({ id: "SLX-REAL000001", userId: "inv-001", kind: "compra", status: "confirmada", amountCop: 1, createdAt: Date.now(), method: "crypto", chainId: 56, providerId: "0xreal" });
    await expect(reset.resetDemoData(actor, PHRASE)).rejects.toMatchObject({ status: 409 });
    await db.delete(schema.ledgerTx).where(drizzle.eq(schema.ledgerTx.id, "SLX-REAL000001"));
  });

  it("borra la comunidad ficticia, la cuenta demo y los movimientos, y conserva las cuentas reales", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const { db } = dbMod;
    const now = new Date();
    await db.insert(schema.user).values({ id: "real-1", name: "Socia Real", email: "socia@solaxy.co", emailVerified: true, createdAt: now, updatedAt: now });
    await db.insert(schema.account).values({ id: "acc-1", accountId: "g-1", providerId: "google", userId: "real-1", createdAt: now, updatedAt: now });
    await profile.saveProfile("real-1", { fullName: "Socia Real", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true });
    // Un pago de prueba de Mercado Pago sí se puede borrar.
    await db.insert(schema.ledgerTx).values({ id: "SLX-SANDBOX001", userId: "real-1", kind: "compra", status: "confirmada", amountCop: 1, createdAt: Date.now(), method: "mercadopago", network: "Mercado Pago (pruebas)", providerId: "sbx-1" });

    const r = await reset.resetDemoData(actor, PHRASE);
    expect(r.deletedUsers).toBeGreaterThan(100);
    const users = await db.select().from(schema.user);
    expect(users.map((u) => u.id)).toEqual(["real-1"]);
    expect(await db.select().from(schema.ledgerTx)).toHaveLength(0);
    expect(await db.select().from(schema.positionEntry)).toHaveLength(0);
    expect(await db.select().from(schema.listing)).toHaveLength(0);
    expect(await profile.getProfile("real-1")).not.toBeNull();
    const byId = Object.fromEntries((await status.configStatus()).checks.map((c) => [c.id, c]));
    expect(byId["datos-demo"].state).toBe("ok");
  });
});
