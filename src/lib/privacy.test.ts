import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser, fundUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-privacy-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let privacy: typeof import("@/lib/privacy");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const admin = { id: "admin-1", name: "Admin de prueba" };

beforeAll(async () => {
  privacy = await import("@/lib/privacy");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  await createUser("d1", { name: "Sin Pagos S.A.S." });
  await createUser("d2", { name: "Con Plan S.A.S." });
  await createUser("d3", { name: "Pagó Antes S.A.S." });
  await fundUser("d2", { planId: "p180", days: 10 });
  const now = Date.now();
  // Un acceso con Google y una sesión, para comprobar que se borran y que no se exportan sus tokens.
  await dbMod.db.insert(schema.account).values({ id: "acc-d1", accountId: "google-123", providerId: "google", userId: "d1", accessToken: "token-secreto-google", createdAt: new Date(now), updatedAt: new Date(now) });
  await dbMod.db.insert(schema.session).values({ id: "ses-d1", token: "token-de-sesion-d1", userId: "d1", expiresAt: new Date(now + 86_400_000), createdAt: new Date(now), updatedAt: new Date(now) });
  // d3 pagó un mes que no generó energía: tiene historia contable, pero no saldo ni plan vigente.
  await dbMod.db.insert(schema.ledgerTx).values({ id: "IWE-PAGADO01", userId: "d3", kind: "plan_mes", status: "confirmada", amountCop: 20_880_000, method: "manual", createdAt: now - 90 * 86_400_000, confirmedAt: now - 90 * 86_400_000 });
}, 120_000);

describe("plazo de respuesta", () => {
  it("15 días hábiles, sin sábados ni domingos, hasta el final del día en Colombia", () => {
    // Miércoles 11 de noviembre de 2026, 10:00 en Bogotá → miércoles 2 de diciembre, 23:59:59.
    const from = Date.UTC(2026, 10, 11, 15);
    expect(privacy.addBusinessDays(from, 15)).toBe(Date.UTC(2026, 11, 3, 4, 59, 59));
    // Un viernes: el primer día hábil es el lunes.
    expect(privacy.addBusinessDays(Date.UTC(2026, 10, 13, 15), 1)).toBe(Date.UTC(2026, 10, 17, 4, 59, 59));
  });
});

describe("descargar mis datos", () => {
  it("trae la cuenta, los datos personales, los planes y los movimientos, sin tokens de sesión ni de Google", async () => {
    const d = await privacy.exportPersonalData("d1");
    expect(d.cuenta).toMatchObject({ id: "d1", correo: "d1@empresa.co", ingresaCon: ["google"] });
    expect(d.datosPersonales).toMatchObject({ titular: "Laura Gómez", documento: "1036123456" });
    const text = JSON.stringify(d);
    expect(text).not.toContain("token-secreto-google");
    expect(text).not.toContain("token-de-sesion-d1");
    const withPlan = await privacy.exportPersonalData("d2");
    expect(withPlan.planes).toHaveLength(1);
    expect(withPlan.movimientos[0]).toMatchObject({ tipo: "pago de un mes", montoCop: 20_880_000 });
  });

  it("una cuenta que no existe no se exporta", async () => {
    await expect(privacy.exportPersonalData("nadie")).rejects.toMatchObject({ status: 404 });
  });
});

describe("pedir la eliminación", () => {
  it("queda pendiente con su plazo; pedirla otra vez devuelve la misma", async () => {
    const a = await privacy.requestDeletion("d1", "Ya no voy a usar el servicio");
    expect(a.created).toBe(true);
    expect(a.request).toMatchObject({ status: "pendiente", kind: "eliminacion", reason: "Ya no voy a usar el servicio" });
    expect(a.request.dueAt).toBeGreaterThan(Date.now() + 14 * 86_400_000);
    const b = await privacy.requestDeletion("d1");
    expect(b).toMatchObject({ created: false, request: { id: a.request.id } });
    expect((await privacy.lastDeletionRequest("d1"))?.id).toBe(a.request.id);
    expect(await privacy.pendingDataRequests()).toBe(1);
  });

  it("no acepta HTML en el motivo", async () => {
    await expect(privacy.requestDeletion("d3", "<script>alert(1)</script>")).rejects.toThrow();
  });
});

describe("atenderla desde el admin", () => {
  it("con un plan vigente y saldo, no se puede eliminar y dice por qué", async () => {
    const { request } = await privacy.requestDeletion("d2");
    const blockers = await privacy.deletionBlockers("d2");
    expect(blockers.join(" ")).toMatch(/plan vigente/);
    expect(blockers.join(" ")).toMatch(/saldo a su favor/);
    await expect(privacy.deleteAccount(admin, request.id)).rejects.toMatchObject({ status: 409 });
    // Se puede responder sin eliminar, con una explicación.
    await expect(privacy.answerRequest(admin, request.id, "corto")).rejects.toThrow();
    const r = await privacy.answerRequest(admin, request.id, "Tiene un plan vigente: la eliminaremos cuando termine y retire su saldo.");
    expect(r.resolution).toMatch(/plan vigente/);
    expect((await privacy.lastDeletionRequest("d2"))?.status).toBe("respondida");
    await expect(privacy.answerRequest(admin, request.id, "Otra respuesta más larga")).rejects.toMatchObject({ status: 409 });
  });

  it("sin pagos: se borran la cuenta, el acceso y todos sus datos personales", async () => {
    const req = await privacy.lastDeletionRequest("d1");
    const r = await privacy.deleteAccount(admin, req!.id);
    expect(r.keepsAccounting).toBe(false);
    const { eq } = drizzle;
    const [u] = await dbMod.db.select().from(schema.user).where(eq(schema.user.id, "d1"));
    expect(u).toMatchObject({ name: "Cuenta eliminada", email: "eliminada-d1@cuentas.invalid", emailVerified: false });
    expect(await dbMod.db.select().from(schema.companyProfile).where(eq(schema.companyProfile.userId, "d1"))).toHaveLength(0);
    expect(await dbMod.db.select().from(schema.session).where(eq(schema.session.userId, "d1"))).toHaveLength(0);
    expect(await dbMod.db.select().from(schema.account).where(eq(schema.account.userId, "d1"))).toHaveLength(0);
    expect((await privacy.lastDeletionRequest("d1"))?.status).toBe("atendida");
    // Aunque su sesión siga en la caché de la cookie, la cuenta eliminada ya no entra.
    const { knownUser } = await import("@/lib/session");
    expect(await knownUser("d1")).toBe(false);
    expect(await knownUser("d2")).toBe(true);
    const [log] = await dbMod.db.select().from(schema.adminAudit).where(eq(schema.adminAudit.action, "eliminar_cuenta"));
    expect(log?.targetUserId).toBe("d1");
  });

  it("con pagos anteriores: se quitan el acceso y el contacto, y se conservan el nombre, el documento y los movimientos", async () => {
    const { request } = await privacy.requestDeletion("d3");
    expect(await privacy.deletionBlockers("d3")).toEqual([]);
    const r = await privacy.deleteAccount(admin, request.id);
    expect(r.keepsAccounting).toBe(true);
    const { eq } = drizzle;
    const [p] = await dbMod.db.select().from(schema.companyProfile).where(eq(schema.companyProfile.userId, "d3"));
    expect(p).toMatchObject({ fullName: "Laura Gómez", docNumber: "1036123456", phone: "", city: "" });
    expect(await dbMod.db.select().from(schema.ledgerTx).where(eq(schema.ledgerTx.userId, "d3"))).toHaveLength(1);
    await expect(privacy.deleteAccount(admin, request.id)).rejects.toMatchObject({ status: 409 });
  });
});
