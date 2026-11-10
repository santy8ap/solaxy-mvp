import { describe, expect, it } from "vitest";
import { nitCheckDigit, parseProfile } from "@/lib/profile-schema";

const base = {
  companyName: "Energía Andina S.A.S.",
  nit: "900123456-8",
  fullName: "Laura Gómez",
  docType: "CC",
  docNumber: "1036123456",
  phone: "3001234567",
  city: "Medellín",
  acceptTerms: true,
};

function errors(input: Record<string, unknown>) {
  const r = parseProfile(input);
  return r.ok ? {} : r.errors;
}

describe("datos de la empresa", () => {
  it("normaliza lo que la gente escribe", () => {
    const r = parseProfile({ ...base, companyName: "  Energía   Andina S.A.S. ", nit: "900.123.456-8", fullName: "  Laura   Gómez  ", docNumber: "1.036.123.456", phone: "+57 300-123-4567", city: " Medellín " });
    expect(r).toEqual({
      ok: true,
      value: { companyName: "Energía Andina S.A.S.", nit: "900123456-8", fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín" },
    });
  });

  it("exige la razón social", () => {
    expect(errors({ ...base, companyName: "" }).companyName).toMatch(/razón social/i);
    expect(errors({ ...base, companyName: "A" }).companyName).toBeDefined();
  });

  it("calcula y verifica el dígito de verificación del NIT", () => {
    expect(nitCheckDigit("899999068")).toBe(1);
    expect(nitCheckDigit("890903938")).toBe(8);
    expect(nitCheckDigit("900123456")).toBe(8);
    expect(errors({ ...base, nit: "900123456-7" }).nit).toMatch(/verificación/i);
    expect(errors({ ...base, nit: "12345" }).nit).toBeDefined();
    expect(errors({ ...base, nit: "" }).nit).toBeDefined();
  });

  it("si el NIT llega sin dígito de verificación, lo completa", () => {
    const r = parseProfile({ ...base, nit: "890903938" });
    expect(r.ok && r.value.nit).toBe("890903938-8");
  });

  it("pide nombre y apellido del representante legal", () => {
    expect(errors({ ...base, fullName: "Laura" }).fullName).toMatch(/apellido/i);
  });

  it("valida el documento del representante: cédula, cédula de extranjería o pasaporte", () => {
    expect(errors({ ...base, docNumber: "12" }).docNumber).toBeDefined();
    expect(errors({ ...base, docNumber: "12a45678" }).docNumber).toBeDefined();
    const pp = parseProfile({ ...base, docType: "PP", docNumber: "ab123456" });
    expect(pp.ok && pp.value.docNumber).toBe("AB123456");
    expect(errors({ ...base, docType: "NIT" }).docType).toBeDefined();
    expect(errors({ ...base, docType: "XX" }).docType).toBeDefined();
  });

  it("acepta celulares y fijos de Colombia de 10 dígitos", () => {
    expect(parseProfile({ ...base, phone: "604 444 5555" }).ok).toBe(true);
    expect(errors({ ...base, phone: "12345" }).phone).toBeDefined();
    expect(errors({ ...base, phone: "2001234567" }).phone).toBeDefined();
  });

  it("exige aceptar los términos y la política de datos", () => {
    expect(errors({ ...base, acceptTerms: false }).acceptTerms).toBeDefined();
  });
});
