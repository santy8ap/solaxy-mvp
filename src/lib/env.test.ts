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
    expect(secret).not.toMatch(/solaxy-demo-secret/);
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
  it("en local sin ADMIN_PIN no hay acceso de administrador (no hay valor por defecto)", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("ADMIN_PIN", "");
    expect((await import("@/lib/env")).adminPin()).toBeNull();
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
    vi.stubEnv("ADMIN_EMAILS", " Socio@Solaxy.co ,ops@solaxy.co");
    const { adminEmailAllowed } = await import("@/lib/env");
    expect(adminEmailAllowed("socio@solaxy.co")).toBe(true);
    expect(adminEmailAllowed("OPS@solaxy.co")).toBe(true);
    expect(adminEmailAllowed("intruso@gmail.com")).toBe(false);
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(adminEmailAllowed("socio@solaxy.co")).toBe(false);
  });

  it("en modo demo, sin ADMIN_EMAILS, solo la cuenta de demostración puede ser administradora", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("ADMIN_EMAILS", "");
    const { adminEmailAllowed } = await import("@/lib/env");
    expect(adminEmailAllowed("demo@solaxy.local")).toBe(true);
    expect(adminEmailAllowed("otro@correo.com")).toBe(false);
  });
});
