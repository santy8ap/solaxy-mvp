import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("modo demo", () => {
  it("está activo por defecto y se apaga solo con DEMO_MODE=false", async () => {
    vi.stubEnv("DEMO_MODE", "");
    expect((await import("@/lib/env")).isDemoMode()).toBe(true);
    vi.stubEnv("DEMO_MODE", "false");
    expect((await import("@/lib/env")).isDemoMode()).toBe(false);
    vi.stubEnv("DEMO_MODE", "0");
    expect((await import("@/lib/env")).isDemoMode()).toBe(false);
  });
});

describe("clave secreta", () => {
  it("en Vercel no arranca sin BETTER_AUTH_SECRET", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const { authSecret } = await import("@/lib/env");
    expect(() => authSecret()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("durante el build no se cae, pero tampoco usa la clave de respaldo pública", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const { authSecret } = await import("@/lib/env");
    const secret = authSecret();
    expect(secret.length).toBeGreaterThan(30);
    expect(secret).not.toMatch(/iwe-pruebas-secreto/);
  });

  it("fuera del modo demo tampoco usa la clave de respaldo", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const { authSecret } = await import("@/lib/env");
    expect(() => authSecret()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("en local usa la clave de respaldo si falta", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect((await import("@/lib/env")).authSecret().length).toBeGreaterThan(20);
  });
});

describe("PIN de administrador", () => {
  it("en local usa el PIN de demostración si falta", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("ADMIN_PIN", "");
    expect((await import("@/lib/env")).adminPin()).toBe("2026");
  });

  it("en Vercel o fuera del modo demo, sin ADMIN_PIN no hay acceso de administrador", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("ADMIN_PIN", "");
    expect((await import("@/lib/env")).adminPin()).toBeNull();
    vi.resetModules();
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DEMO_MODE", "false");
    expect((await import("@/lib/env")).adminPin()).toBeNull();
    vi.stubEnv("ADMIN_PIN", "481516");
    expect((await import("@/lib/env")).adminPin()).toBe("481516");
  });

  it("con dinero real solo pueden ser administradores los correos de ADMIN_EMAILS", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("ADMIN_EMAILS", " Socio@InWorldEnergy.co ,ops@inworldenergy.co");
    const { adminEmailAllowed } = await import("@/lib/env");
    expect(adminEmailAllowed("socio@inworldenergy.co")).toBe(true);
    expect(adminEmailAllowed("OPS@inworldenergy.co")).toBe(true);
    expect(adminEmailAllowed("intruso@gmail.com")).toBe(false);
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(adminEmailAllowed("socio@inworldenergy.co")).toBe(false);
  });

  it("en modo de pruebas, la cuenta de pruebas puede administrar (con el PIN) aunque no esté en ADMIN_EMAILS", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("ADMIN_EMAILS", "");
    const { adminEmailAllowed } = await import("@/lib/env");
    expect(adminEmailAllowed("pruebas@inworldenergy.local")).toBe(true);
    // La lista de producción puede no traerla: sigue pudiendo entrar mientras dure el modo de pruebas.
    vi.stubEnv("ADMIN_EMAILS", "socio@inworldenergy.co");
    expect(adminEmailAllowed("Pruebas@InWorldEnergy.local")).toBe(true);
  });

  it("en modo de pruebas, sin ADMIN_EMAILS, las demás cuentas no pueden administrar", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("ADMIN_EMAILS", "");
    expect((await import("@/lib/env")).adminEmailAllowed("cualquiera@gmail.com")).toBe(false);
  });

  it("con dinero real, la cuenta de pruebas no puede administrar", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("ADMIN_EMAILS", "socio@inworldenergy.co");
    expect((await import("@/lib/env")).adminEmailAllowed("pruebas@inworldenergy.local")).toBe(false);
  });
});
