import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-session-")), "test.db")}`;

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
