import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let rates: typeof import("@/lib/rates");
const calls: { url: string; headers: Headers }[] = [];
const PRICES = { tether: { cop: 3980, usd: 1 }, binancecoin: { cop: 2_650_000, usd: 665 }, ethereum: { cop: 13_000_000, usd: 3260 }, bitcoin: { cop: 400_000_000, usd: 100_000 } };

beforeEach(async () => {
  vi.resetModules();
  calls.length = 0;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(PRICES));
  });
  rates = await import("@/lib/rates");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("precios para mostrar (CoinGecko)", () => {
  it("usan la llave Demo de CoinGecko si está configurada", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "CG-llave-de-prueba");
    const r = await rates.getRates();
    expect(r.source).toBe("coingecko");
    expect(r.prices.BNB).toEqual({ cop: 2_650_000, usd: 665 });
    expect(calls[0].headers.get("x-cg-demo-api-key")).toBe("CG-llave-de-prueba");
    expect(calls[0].url).toMatch(/^https:\/\/api\.coingecko\.com\/api\/v3\/simple\/price\?/);
  });

  it("sin llave también funcionan (con el límite público)", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "");
    await rates.getRates();
    expect(calls[0].headers.has("x-cg-demo-api-key")).toBe(false);
  });

  it("respetan COINGECKO_API_BASE, como la cotización cripto", async () => {
    vi.stubEnv("COINGECKO_API_BASE", "http://localhost:4020/coingecko/");
    await rates.getRates();
    expect(calls[0].url).toMatch(/^http:\/\/localhost:4020\/coingecko\/simple\/price\?/);
  });
});
