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
  for (const k of ["DEMO_MODE", "WOMPI_PUBLIC_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET", "CRYPTO_TREASURY_ADDRESS", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_PIN", "ADMIN_EMAILS", "TURSO_DATABASE_URL", "VERCEL"]) {
    vi.stubEnv(k, "");
  }
});

describe("lista de configuración", () => {
  it("dice qué falta, con el nombre exacto de cada variable", async () => {
    const s = await status.configStatus();
    const byId = Object.fromEntries(s.checks.map((c) => [c.id, c]));
    expect(byId["wompi-llave"]).toMatchObject({ state: "falta", vars: ["WOMPI_PUBLIC_KEY"] });
    expect(byId["wompi-integridad"]).toMatchObject({ state: "falta", vars: ["WOMPI_INTEGRITY_SECRET"] });
    expect(byId["cripto-billetera"]).toMatchObject({ state: "falta", vars: ["CRYPTO_TREASURY_ADDRESS"] });
    expect(byId["google"]).toMatchObject({ state: "falta", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] });
    expect(s.readyForLive).toBe(false);
    expect(s.webhookUrl).toMatch(/\/api\/webhooks\/wompi$/);
  });

  it("marca como listo lo que está configurado y avisa si la llave de Wompi es de pruebas", async () => {
    vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_x");
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    const byId = Object.fromEntries((await status.configStatus()).checks.map((c) => [c.id, c]));
    expect(byId["wompi-llave"].state).toBe("aviso");
    expect(byId["wompi-integridad"].state).toBe("ok");
    expect(byId["cripto-billetera"].state).toBe("ok");
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
    // Wompi de pruebas (sandbox) sí se puede borrar.
    await db.insert(schema.ledgerTx).values({ id: "SLX-SANDBOX001", userId: "real-1", kind: "compra", status: "confirmada", amountCop: 1, createdAt: Date.now(), method: "wompi", network: "Wompi (sandbox)", providerId: "sbx-1" });

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
