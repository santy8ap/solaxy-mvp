import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-equipo-")), "test.db")}`;
const SECRET = "secreto-de-prueba-suficientemente-largo-123";
vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
const OWNERS = " Dueno@Empresa.co , socia@empresa.co";
vi.stubEnv("ADMIN_EMAILS", OWNERS);

/** La cookie de sesión del navegador que hace la petición (la firma igual que Better Auth). */
let cookie = "";
vi.mock("next/headers", () => ({
  headers: async () => new Headers(cookie ? { cookie } : {}),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));

let team: typeof import("./team");
let access: typeof import("./access");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const owner = { id: "dueno", name: "Dueño de Prueba", email: "dueno@empresa.co" };

/** Abre una sesión para esa cuenta y la deja como la del navegador. */
async function signIn(userId: string) {
  const token = `tok-${userId}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  await dbMod.db.insert(schema.session).values({ id: `ses-${token}`, token, userId, expiresAt: new Date(now + 86_400_000), createdAt: new Date(now), updatedAt: new Date(now) });
  cookie = `iwe.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", SECRET).update(token).digest("base64")}`)}`;
}

async function status(check: () => Promise<unknown>) {
  const r = await check();
  return r instanceof Response ? r.status : (r as { role: string }).role;
}

async function newUser(id: string, email: string, name: string) {
  await createUser(id, { name });
  await dbMod.db.update(schema.user).set({ email }).where(drizzle.eq(schema.user.id, id));
}

beforeAll(async () => {
  team = await import("./team");
  access = await import("./access");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  await newUser("dueno", "dueno@empresa.co", "Dueño de Prueba");
  await newUser("contadora", "contadora@empresa.co", "Contadora Externa");
  await newUser("cliente", "cliente@empresa.co", "Cliente Común");
}, 120_000);

afterEach(() => {
  cookie = "";
  vi.stubEnv("ADMIN_EMAILS", OWNERS);
  vi.stubEnv("DEMO_MODE", "");
});

describe("quién administra (sin PIN)", () => {
  it("los correos de ADMIN_EMAILS son propietarios, sin importar mayúsculas ni espacios; los demás no administran", async () => {
    expect(await team.adminRoleOf("dueno@empresa.co")).toBe("propietario");
    expect(await team.adminRoleOf("SOCIA@empresa.co ")).toBe("propietario");
    expect(await team.adminRoleOf("cliente@empresa.co")).toBeNull();
    expect(team.ownerEmails()).toEqual(["dueno@empresa.co", "socia@empresa.co"]);
  });

  it("con su sesión de Google, un propietario entra a la API del admin y puede cambiar el equipo; un cliente no; sin sesión, 401", async () => {
    await signIn("dueno");
    expect(await status(access.requireAdminApi)).toBe("propietario");
    expect(await status(access.requireOwnerApi)).toBe("propietario");
    await signIn("cliente");
    expect(await status(access.requireAdminApi)).toBe(403);
    cookie = "";
    expect(await status(access.requireAdminApi)).toBe(401);
  });

  it("un propietario agrega a alguien al equipo: entra sin PIN, no puede cambiar el equipo, y quitarlo vale de inmediato aunque tenga la sesión abierta", async () => {
    await signIn("contadora");
    expect(await status(access.requireAdminApi)).toBe(403);
    const row = await team.addAdmin(owner, { email: " Contadora@Empresa.co ", note: "Contabilidad" });
    expect(row).toMatchObject({ email: "contadora@empresa.co", note: "Contabilidad", addedBy: "Dueño de Prueba (dueno@empresa.co)" });
    expect(await status(access.requireAdminApi)).toBe("administrador");
    expect(await status(access.requireOwnerApi)).toBe(403);
    await team.removeAdmin(owner, "contadora@empresa.co");
    // La misma sesión, sin volver a entrar: ya no tiene acceso.
    expect(await status(access.requireAdminApi)).toBe(403);
    const log = await dbMod.db.select().from(schema.adminAudit).where(drizzle.inArray(schema.adminAudit.action, ["agregar_admin", "quitar_admin"]));
    expect(log.map((l) => l.summary)).toEqual(["Dio acceso de administrador a contadora@empresa.co (Contabilidad)", "Le quitó el acceso de administrador a contadora@empresa.co"]);
    expect(log.every((l) => l.actorUserId === "dueno")).toBe(true);
  });

  it("reglas del equipo: correo válido, sin repetir, sin propietarios ni la cuenta de pruebas, y los propietarios no se quitan desde aquí", async () => {
    await expect(team.addAdmin(owner, { email: "no es un correo" })).rejects.toMatchObject({ status: 400 });
    await expect(team.addAdmin(owner, { email: "socia@empresa.co" })).rejects.toMatchObject({ status: 409 });
    await expect(team.addAdmin(owner, { email: "pruebas@inworldenergy.local" })).rejects.toMatchObject({ status: 400 });
    await expect(team.addAdmin(owner, { email: "nuevo@empresa.co", note: "<b>jefe</b>" })).rejects.toThrow(/< ni >/);
    await team.addAdmin(owner, { email: "operaciones@empresa.co" });
    await expect(team.addAdmin(owner, { email: "OPERACIONES@empresa.co" })).rejects.toMatchObject({ status: 409 });
    await expect(team.removeAdmin(owner, "dueno@empresa.co")).rejects.toMatchObject({ status: 409 });
    await expect(team.removeAdmin(owner, "nadie@empresa.co")).rejects.toMatchObject({ status: 404 });
  });

  it("la cuenta de pruebas solo administra como propietaria y solo en modo de pruebas", async () => {
    vi.stubEnv("ADMIN_EMAILS", `${OWNERS}, pruebas@inworldenergy.local`);
    expect(await team.adminRoleOf("pruebas@inworldenergy.local")).toBe("propietario");
    vi.stubEnv("DEMO_MODE", "false");
    expect(await team.adminRoleOf("pruebas@inworldenergy.local")).toBeNull();
    expect(team.ownerEmails()).not.toContain("pruebas@inworldenergy.local");
  });

  it("el equipo: primero los propietarios, con su nombre y su último ingreso, y luego quienes agregaron, con quién les dio acceso", async () => {
    await signIn("dueno");
    const list = await team.listTeam();
    expect(list.map((m) => [m.email, m.role])).toEqual([
      ["dueno@empresa.co", "propietario"],
      ["socia@empresa.co", "propietario"],
      ["operaciones@empresa.co", "administrador"],
    ]);
    expect(list[0]).toMatchObject({ name: "Dueño de Prueba", lastLoginAt: expect.any(Number) });
    // Quien todavía no ha entrado aparece sin nombre ni último ingreso.
    expect(list[1]).toMatchObject({ name: null, lastLoginAt: null });
    expect(list[2]).toMatchObject({ addedBy: "Dueño de Prueba (dueno@empresa.co)", addedAt: expect.any(Number) });
  });
});
