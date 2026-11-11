import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MP_LIMITS, limitsFromMethods, mercadoPagoFor, mercadoPagoLimits } from "@/lib/payments/mercadopago-limits";

/** Lo que respondió GET /v1/payment_methods para una cuenta de Colombia (11 de noviembre de 2026). */
const COLOMBIA = [
  { id: "pse", payment_type_id: "bank_transfer", status: "active", min_allowed_amount: 1600, max_allowed_amount: 340_000_000 },
  { id: "amex", payment_type_id: "credit_card", status: "active", min_allowed_amount: 1000, max_allowed_amount: 50_000_000 },
  { id: "codensa", payment_type_id: "credit_card", status: "active", min_allowed_amount: 100, max_allowed_amount: 5_000_000 },
  { id: "visa", payment_type_id: "credit_card", status: "active", min_allowed_amount: 1000, max_allowed_amount: 50_000_000 },
  { id: "debvisa", payment_type_id: "debit_card", status: "active", min_allowed_amount: 1000, max_allowed_amount: 50_000_000 },
  { id: "visa", payment_type_id: "prepaid_card", status: "active", min_allowed_amount: 1600, max_allowed_amount: 30_000_000 },
  { id: "efecty", payment_type_id: "ticket", status: "active", min_allowed_amount: 5000, max_allowed_amount: 8_000_000 },
];

const g = globalThis as unknown as { __iweMpLimits?: unknown };

afterEach(() => {
  vi.unstubAllEnvs();
  delete g.__iweMpLimits;
});

describe("límites por pago de Mercado Pago", () => {
  it("toma el tope más alto de las tarjetas y el de PSE", () => {
    expect(limitsFromMethods(COLOMBIA)).toEqual({ cardMaxCop: 50_000_000, pseMaxCop: 340_000_000 });
  });

  it("no cuenta los medios inactivos ni el efectivo", () => {
    const methods = [
      { id: "pse", payment_type_id: "bank_transfer", status: "active", max_allowed_amount: 100_000_000 },
      { id: "visa", payment_type_id: "credit_card", status: "inactive", max_allowed_amount: 900_000_000 },
      { id: "master", payment_type_id: "credit_card", status: "active", max_allowed_amount: 20_000_000 },
      { id: "efecty", payment_type_id: "ticket", status: "active", max_allowed_amount: 999_000_000 },
    ];
    expect(limitsFromMethods(methods)).toEqual({ cardMaxCop: 20_000_000, pseMaxCop: 100_000_000 });
  });

  it("si la respuesta no trae topes, usa los conocidos", () => {
    expect(limitsFromMethods([])).toEqual(DEFAULT_MP_LIMITS);
    expect(limitsFromMethods(null)).toEqual(DEFAULT_MP_LIMITS);
    expect(limitsFromMethods([{ id: "pse", payment_type_id: "bank_transfer", status: "active" }])).toEqual(DEFAULT_MP_LIMITS);
  });

  it("decide qué se puede pagar con Mercado Pago según el monto del mes", () => {
    const l = { cardMaxCop: 50_000_000, pseMaxCop: 340_000_000 };
    // Plan 180 y Plan 360: tarjeta o PSE.
    expect(mercadoPagoFor(20_880_000, l)).toEqual({ available: true, cards: true });
    expect(mercadoPagoFor(40_800_000, l)).toEqual({ available: true, cards: true });
    expect(mercadoPagoFor(50_000_000, l)).toEqual({ available: true, cards: true });
    // Plan 540 y Plan 720: solo PSE.
    expect(mercadoPagoFor(59_400_000, l)).toEqual({ available: true, cards: false });
    expect(mercadoPagoFor(76_800_000, l)).toEqual({ available: true, cards: false });
    // Más que el tope de PSE: Mercado Pago no lo recibe.
    expect(mercadoPagoFor(340_000_001, l)).toEqual({ available: false, cards: false });
  });

  it("consulta los topes a Mercado Pago una vez y los recuerda", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-prueba");
    vi.stubEnv("MERCADOPAGO_API_BASE", "https://mp.falso");
    const fetch = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://mp.falso/v1/payment_methods");
      return new Response(JSON.stringify(COLOMBIA));
    });
    expect(await mercadoPagoLimits({ fetch: fetch as unknown as typeof globalThis.fetch })).toEqual({ cardMaxCop: 50_000_000, pseMaxCop: 340_000_000 });
    await mercadoPagoLimits({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("si Mercado Pago no responde, usa los topes conocidos", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-prueba");
    const down = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    expect(await mercadoPagoLimits({ fetch: down })).toEqual(DEFAULT_MP_LIMITS);
    const fails = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    delete g.__iweMpLimits;
    expect(await mercadoPagoLimits({ fetch: fails })).toEqual(DEFAULT_MP_LIMITS);
  });

  it("sin credenciales no consulta nada", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    const fetch = vi.fn();
    expect(await mercadoPagoLimits({ fetch: fetch as unknown as typeof globalThis.fetch })).toEqual(DEFAULT_MP_LIMITS);
    expect(fetch).not.toHaveBeenCalled();
  });
});
