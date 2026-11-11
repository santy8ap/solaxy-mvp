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

describe("seguridad del ingreso (contra la API real de Better Auth)", () => {
  const BASE = "http://localhost:3000";
  const post = (path: string, body: unknown, ip = "203.0.113.7") =>
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });

  async function setup() {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");
    vi.stubEnv("BETTER_AUTH_URL", BASE);
    const { auth } = await import("@/lib/auth");
    const { ensureReady } = await import("@/lib/db/init");
    await ensureReady();
    return auth;
  }

  it("nadie puede crear una cuenta con correo y contraseña desde afuera, ni en modo de pruebas", async () => {
    const auth = await setup();
    const res = await auth.handler(post("/sign-up/email", { email: "santy@empresa.co", password: "una-clave-larga-123", name: "Intruso" }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    const { db } = await import("@/lib/db");
    const { user } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    expect(await db.select().from(user).where(eq(user.email, "santy@empresa.co"))).toHaveLength(0);
  });

  it("la cuenta de pruebas la crea el servidor y entra con su contraseña", async () => {
    const auth = await setup();
    const { db } = await import("@/lib/db");
    const { ensureDemoAccount } = await import("@/lib/db/seed");
    const { env } = await import("@/lib/env");
    const id = await ensureDemoAccount(db);
    expect(await ensureDemoAccount(db)).toBe(id);
    const res = await auth.api.signInEmail({ body: { email: env.demoEmail, password: env.demoPassword } });
    expect(res.user.id).toBe(id);
  });

  it("después de 5 contraseñas equivocadas en un minuto, hay que esperar", async () => {
    const auth = await setup();
    const { db } = await import("@/lib/db");
    const { ensureDemoAccount } = await import("@/lib/db/seed");
    const { env } = await import("@/lib/env");
    await ensureDemoAccount(db);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await auth.handler(post("/sign-in/email", { email: env.demoEmail, password: `equivocada-${i}` }, "198.51.100.23"));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    // Aunque ahora acierte, sigue bloqueado hasta que pase el minuto.
    const ok = await auth.handler(post("/sign-in/email", { email: env.demoEmail, password: env.demoPassword }, "198.51.100.23"));
    expect(ok.status).toBe(429);
    // Otra IP no queda bloqueada.
    const other = await auth.handler(post("/sign-in/email", { email: env.demoEmail, password: env.demoPassword }, "198.51.100.99"));
    expect(other.status).toBe(200);
  });
});
