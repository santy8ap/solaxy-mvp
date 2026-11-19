import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-session-")), "test.db")}`;

let session: typeof import("@/lib/session");

beforeAll(async () => {
  session = await import("@/lib/session");
  await createUser("cliente-1", { profile: false });
}, 120_000);

describe("sesión de un usuario que esta base no conoce", () => {
  // Sin Turso, en Vercel cada instancia tiene su propia base: la cookie de sesión puede
  // nombrar a un usuario que no existe aquí. Debe tratarse como sesión cerrada, no como error.
  it("reconoce a un usuario que sí existe", async () => {
    expect(await session.knownUser("cliente-1")).toBe(true);
  });

  it("no reconoce a un usuario que no existe en esta base", async () => {
    expect(await session.knownUser("usuario-de-otra-instancia")).toBe(false);
  });
});

describe("la sesión sigue abierta en la base", () => {
  // La cookie de sesión queda en caché 5 minutos: sin esta revisión, una sesión cerrada (por el equipo o al
  // eliminar la cuenta) seguiría funcionando hasta que la caché venciera.
  async function openSession(id: string, userId: string, expiresAt: number) {
    const { db } = await import("@/lib/db");
    const { session: table } = await import("@/lib/db/schema");
    const now = Date.now();
    await db.insert(table).values({ id, token: `tok-${id}`, userId, expiresAt: new Date(expiresAt), createdAt: new Date(now), updatedAt: new Date(now) });
  }

  it("una sesión abierta y vigente de esa cuenta sí; cerrada, vencida o de otra cuenta, no", async () => {
    await createUser("cliente-2", { profile: false });
    await openSession("ses-abierta", "cliente-1", Date.now() + 86_400_000);
    await openSession("ses-vencida", "cliente-1", Date.now() - 1000);
    expect(await session.knownSession("cliente-1", "ses-abierta")).toBe(true);
    expect(await session.knownSession("cliente-1", "ses-vencida")).toBe(false);
    expect(await session.knownSession("cliente-2", "ses-abierta")).toBe(false);
    expect(await session.knownSession("cliente-1", "ses-que-no-existe")).toBe(false);
    const { db } = await import("@/lib/db");
    const { session: table } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(table).where(eq(table.id, "ses-abierta"));
    expect(await session.knownSession("cliente-1", "ses-abierta")).toBe(false);
  });
});
