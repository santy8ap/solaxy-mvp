import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCheckoutUrl, integritySignature, mapWompiStatus, verifyEventChecksum, type WompiEvent } from "@/lib/payments/wompi";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("firma de integridad del checkout", () => {
  it("coincide con el ejemplo de la documentación de Wompi", () => {
    expect(
      integritySignature({ reference: "sk8-438k4-xmxm392-sn2m", amountInCents: 2_490_000, currency: "COP", secret: "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6" }),
    ).toBe("37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5");
  });
});

describe("checksum de los eventos (webhook)", () => {
  const secret = "test_events_secreto_de_prueba";
  const event = (over: Partial<WompiEvent["data"]["transaction"]> = {}, checksum?: string): WompiEvent => {
    const transaction = { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 4_490_000, reference: "SLX-ABC123", currency: "COP", ...over };
    return {
      event: "transaction.updated",
      data: { transaction },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        // Vector calculado aparte: valores en orden + timestamp + secreto.
        checksum: checksum ?? sha256(`1234-1610641025-49201APPROVED4490000${1530291411}${secret}`).toUpperCase(),
      },
      timestamp: 1530291411,
    };
  };

  it("acepta el checksum correcto, en mayúsculas o minúsculas", () => {
    expect(verifyEventChecksum(event(), secret)).toBe(true);
    const lower = event({}, sha256(`1234-1610641025-49201APPROVED4490000${1530291411}${secret}`));
    expect(verifyEventChecksum(lower, secret)).toBe(true);
  });

  it("rechaza el evento si alguien cambió el estado o el monto", () => {
    expect(verifyEventChecksum(event({ status: "DECLINED" }), secret)).toBe(false);
    expect(verifyEventChecksum(event({ amount_in_cents: 1 }), secret)).toBe(false);
  });

  it("rechaza con otro secreto, sin firma o sin propiedades", () => {
    expect(verifyEventChecksum(event(), "otro-secreto")).toBe(false);
    expect(verifyEventChecksum({ ...event(), signature: undefined } as unknown as WompiEvent, secret)).toBe(false);
    expect(verifyEventChecksum({ ...event(), signature: { properties: [], checksum: sha256(`1530291411${secret}`) } }, secret)).toBe(false);
  });

  it("también acepta el checksum del encabezado X-Event-Checksum", () => {
    const e = event({}, "no-coincide");
    expect(verifyEventChecksum(e, secret, sha256(`1234-1610641025-49201APPROVED4490000${1530291411}${secret}`))).toBe(true);
  });
});

describe("URL del Web Checkout", () => {
  it("lleva la llave pública, el monto, la referencia, la firma y los datos del cliente", () => {
    const url = new URL(
      buildCheckoutUrl({
        checkoutUrl: "https://checkout.wompi.co/p/",
        publicKey: "pub_test_abc",
        reference: "SLX-ABC123",
        amountInCents: 480_000_000,
        signature: "f".repeat(64),
        redirectUrl: "https://solaxy.co/pagos/resultado",
        customer: { email: "laura@correo.co", fullName: "Laura Gómez", phone: "3001234567", docType: "NIT", docNumber: "900123456-8" },
      }),
    );
    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    const p = url.searchParams;
    expect(p.get("public-key")).toBe("pub_test_abc");
    expect(p.get("currency")).toBe("COP");
    expect(p.get("amount-in-cents")).toBe("480000000");
    expect(p.get("reference")).toBe("SLX-ABC123");
    expect(p.get("signature:integrity")).toBe("f".repeat(64));
    expect(p.get("redirect-url")).toBe("https://solaxy.co/pagos/resultado");
    expect(p.get("customer-data:email")).toBe("laura@correo.co");
    expect(p.get("customer-data:full-name")).toBe("Laura Gómez");
    expect(p.get("customer-data:phone-number")).toBe("3001234567");
    expect(p.get("customer-data:phone-number-prefix")).toBe("+57");
    expect(p.get("customer-data:legal-id")).toBe("900123456");
    expect(p.get("customer-data:legal-id-type")).toBe("NIT");
  });
});

describe("estados de Wompi", () => {
  it("se traducen al estado de la orden", () => {
    expect(mapWompiStatus("APPROVED")).toBe("aprobada");
    expect(mapWompiStatus("DECLINED")).toBe("fallida");
    expect(mapWompiStatus("VOIDED")).toBe("fallida");
    expect(mapWompiStatus("ERROR")).toBe("fallida");
    expect(mapWompiStatus("PENDING")).toBe("pendiente");
    expect(mapWompiStatus("ALGO_NUEVO")).toBe("pendiente");
  });
});
