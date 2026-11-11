import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mercadoPagoConfig } from "@/lib/payments/config";
import { buildPreference, failureReason, isSafeCheckoutUrl, mapMpStatus, verifyWebhookSignature } from "@/lib/payments/mercadopago";

afterEach(() => vi.unstubAllEnvs());

describe("configuración de Mercado Pago", () => {
  it("está apagado sin Access Token", () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    expect(mercadoPagoConfig().enabled).toBe(false);
  });

  it("reconoce las credenciales de prueba y las de producción", () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-123-abc");
    expect(mercadoPagoConfig()).toMatchObject({ enabled: true, sandbox: true, apiBase: "https://api.mercadopago.com" });
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-123-abc");
    expect(mercadoPagoConfig()).toMatchObject({ enabled: true, sandbox: false });
  });

  it("rechaza valores que no son credenciales de Mercado Pago", () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "pk_algo");
    expect(mercadoPagoConfig().enabled).toBe(false);
  });
});

describe("firma de las notificaciones (webhook)", () => {
  const secret = "clave-secreta-del-webhook";
  const ts = "1704908010";
  const requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
  // Vector calculado aparte: HMAC-SHA256 del manifiesto id;request-id;ts.
  const v1 = createHmac("sha256", secret).update(`id:123456;request-id:${requestId};ts:${ts};`).digest("hex");

  it("acepta la firma correcta", () => {
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, dataId: "123456", secret })).toBe(true);
  });

  it("acepta el encabezado con espacios y en otro orden", () => {
    expect(verifyWebhookSignature({ xSignature: ` v1=${v1} , ts=${ts}`, xRequestId: requestId, dataId: "123456", secret })).toBe(true);
  });

  it("rechaza otro pago, otro secreto o sin firma", () => {
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, dataId: "999", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, dataId: "123456", secret: "otro" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: requestId, dataId: "123456", secret })).toBe(false);
  });

  it("si falta el request-id, se omite del manifiesto", () => {
    const sig = createHmac("sha256", secret).update(`id:abc123;ts:${ts};`).digest("hex");
    // Los id alfanuméricos van en minúsculas.
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${sig}`, xRequestId: null, dataId: "ABC123", secret })).toBe(true);
  });
});

describe("estados de Mercado Pago", () => {
  it("se traducen al estado de la orden", () => {
    expect(mapMpStatus("approved")).toBe("aprobada");
    expect(mapMpStatus("rejected")).toBe("fallida");
    expect(mapMpStatus("cancelled")).toBe("fallida");
    expect(mapMpStatus("pending")).toBe("pendiente");
    expect(mapMpStatus("in_process")).toBe("pendiente");
    expect(mapMpStatus("authorized")).toBe("pendiente");
    expect(mapMpStatus("refunded")).toBe("devuelta");
    expect(mapMpStatus("charged_back")).toBe("devuelta");
  });

  it("explica el motivo de un rechazo", () => {
    expect(failureReason({ status: "rejected", status_detail: "cc_rejected_insufficient_amount" })).toMatch(/fondos/i);
    expect(failureReason({ status: "cancelled", status_detail: "expired" })).toMatch(/cancel|venci/i);
    expect(failureReason({ status: "rejected", status_detail: "algo_nuevo" })).toMatch(/rechaz/i);
  });
});

describe("preferencia del Checkout Pro", () => {
  const base = {
    orderId: "IWE-ABC1234567",
    title: "Plan 180 · mes 1 de 3 · In World Energy",
    amountCop: 9_600_000,
    baseUrl: "https://solaxy-mvp.vercel.app",
    payer: { email: "laura@correo.co", fullName: "Laura Gómez Restrepo" },
  };

  it("cobra el monto exacto en pesos, con la orden como referencia", () => {
    const p = buildPreference(base);
    expect(p.items).toEqual([{ id: "plan-energia", title: "Plan 180 · mes 1 de 3 · In World Energy", quantity: 1, currency_id: "COP", unit_price: 9_600_000 }]);
    expect(p.external_reference).toBe("IWE-ABC1234567");
    expect(p.payer).toEqual({ email: "laura@correo.co", name: "Laura", surname: "Gómez Restrepo" });
  });

  it("vuelve a /pagos/resultado con la referencia", () => {
    const p = buildPreference(base);
    expect(p.back_urls.success).toBe("https://solaxy-mvp.vercel.app/pagos/resultado?ref=IWE-ABC1234567");
    expect(p.back_urls.pending).toBe(p.back_urls.success);
    expect(p.back_urls.failure).toBe(p.back_urls.success);
    expect(p.auto_return).toBe("approved");
  });

  it("no define notification_url: los avisos llegan por el webhook de Tus integraciones, que viene firmado", () => {
    expect("notification_url" in buildPreference(base)).toBe(false);
    expect("notification_url" in buildPreference({ ...base, baseUrl: "http://localhost:3000" })).toBe(false);
  });

  it("solo ofrece tarjetas y PSE (Nequi va por PSE): sin pagos en efectivo", () => {
    const p = buildPreference(base);
    expect(p.payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }, { id: "atm" }]);
  });

  it("si el monto pasa el tope de las tarjetas, solo deja PSE", () => {
    const p = buildPreference({ ...base, amountCop: 76_800_000, cards: false });
    expect(p.payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }, { id: "atm" }, { id: "credit_card" }, { id: "debit_card" }, { id: "prepaid_card" }]);
  });
});

describe("dirección del checkout que devuelve Mercado Pago", () => {
  it("solo se sigue si es https (o localhost en pruebas locales)", () => {
    expect(isSafeCheckoutUrl("https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=1")).toBe(true);
    expect(isSafeCheckoutUrl("http://localhost:4010/checkout/v1/redirect?pref_id=1")).toBe(true);
    expect(isSafeCheckoutUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCheckoutUrl("http://sitio-falso.com/checkout")).toBe(false);
    expect(isSafeCheckoutUrl("data:text/html,hola")).toBe(false);
    expect(isSafeCheckoutUrl("no es una url")).toBe(false);
  });
});
