import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-session-")), "test.db")}`;

let session: typeof import("@/lib/session");

beforeAll(async () => {
  session = await import("@/lib/session");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
}, 120_000);

describe("sesión de un usuario que esta base no conoce", () => {
  // Sin Turso, en Vercel cada instancia tiene su propia base: la cookie de sesión puede
  // nombrar a un usuario que no existe aquí. Debe tratarse como sesión cerrada, no como error.
  it("reconoce a un usuario que sí existe", async () => {
    expect(await session.knownUser("inv-001")).toBe(true);
  });

  it("no reconoce a un usuario que no existe en esta base", async () => {
    expect(await session.knownUser("usuario-de-otra-instancia")).toBe(false);
  });
});
