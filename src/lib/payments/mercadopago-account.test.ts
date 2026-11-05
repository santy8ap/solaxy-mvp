import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let acc: typeof import("@/lib/payments/mercadopago-account");

/** /users/me falso: cuenta todas las llamadas. */
function usersMe(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${String(input)} ${new Headers(init?.headers).get("authorization")}`);
    return new Response(JSON.stringify(body), { status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
const TEST_USER = { id: 3821328050, nickname: "TESTUSER123", site_id: "MCO", tags: ["user_product_seller", "test_user", "normal"] };
const REAL_USER = { id: 123, nickname: "SOLAXY", site_id: "MCO", tags: ["normal"] };

beforeEach(async () => {
  vi.resetModules();
  delete (globalThis as { __solaxyMpAccount?: unknown }).__solaxyMpAccount;
  vi.stubEnv("MERCADOPAGO_API_BASE", "https://mp.falso");
  acc = await import("@/lib/payments/mercadopago-account");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("¿las credenciales de Mercado Pago son de prueba?", () => {
  it("sin credenciales no pregunta nada", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    const mp = usersMe(TEST_USER);
    expect(await acc.isMercadoPagoTest({ fetch: mp.fetch })).toBe(false);
    expect(mp.calls).toHaveLength(0);
  });

  it("las antiguas (TEST-…) son de prueba sin preguntar", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-123-abc");
    const mp = usersMe(REAL_USER);
    expect(await acc.isMercadoPagoTest({ fetch: mp.fetch })).toBe(true);
    expect(mp.calls).toHaveLength(0);
  });

  it("las nuevas empiezan por APP_USR- como las reales: se pregunta a Mercado Pago una sola vez", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    const mp = usersMe(TEST_USER);
    expect(await acc.isMercadoPagoTest({ fetch: mp.fetch })).toBe(true);
    expect(await acc.isMercadoPagoTest({ fetch: mp.fetch })).toBe(true);
    expect(mp.calls).toEqual(["https://mp.falso/users/me Bearer APP_USR-cuenta-de-prueba"]);
    expect(await acc.mercadoPagoAccount({ fetch: mp.fetch })).toEqual({ testUser: true, siteId: "MCO", nickname: "TESTUSER123" });
  });

  it("una cuenta real no es de prueba", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-real");
    expect(await acc.isMercadoPagoTest({ fetch: usersMe(REAL_USER).fetch })).toBe(false);
  });

  it("si Mercado Pago no responde, decide por el prefijo y vuelve a preguntar al minuto", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    const down = usersMe({ message: "error" }, 500);
    expect(await acc.isMercadoPagoTest({ fetch: down.fetch })).toBe(false);
    expect(await acc.isMercadoPagoTest({ fetch: down.fetch })).toBe(false);
    expect(down.calls).toHaveLength(1);
    vi.setSystemTime(Date.now() + 61_000);
    const up = usersMe(TEST_USER);
    expect(await acc.isMercadoPagoTest({ fetch: up.fetch })).toBe(true);
    expect(up.calls).toHaveLength(1);
  });

  it("si cambian las credenciales, vuelve a preguntar", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    expect(await acc.isMercadoPagoTest({ fetch: usersMe(TEST_USER).fetch })).toBe(true);
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-real");
    const mp = usersMe(REAL_USER);
    expect(await acc.isMercadoPagoTest({ fetch: mp.fetch })).toBe(false);
    expect(mp.calls).toHaveLength(1);
  });

  it("si la conexión falla (sin respuesta), no rompe: decide por el prefijo", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-cuenta-de-prueba");
    const broken = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await acc.isMercadoPagoTest({ fetch: broken })).toBe(false);
  });
});
