import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-auth-")), "test.db")}`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("formas de ingresar", () => {
  it("en modo demo existe el ingreso con correo y contraseña (la cuenta demo)", async () => {
    vi.stubEnv("DEMO_MODE", "");
    const { auth } = await import("@/lib/auth");
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
  });

  it("con dinero real solo se entra con Google: nadie puede registrarse con correo y contraseña", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");
    const { auth } = await import("@/lib/auth");
    expect(auth.options.emailAndPassword?.enabled).toBe(false);
  });
});
