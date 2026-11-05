import { describe, expect, it } from "vitest";
import { nitCheckDigit, parseProfile } from "@/lib/profile-schema";

const base = { fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true };

function errors(input: Record<string, unknown>) {
  const r = parseProfile(input);
  return r.ok ? {} : r.errors;
}

describe("datos del inversionista", () => {
  it("normaliza lo que la gente escribe", () => {
    const r = parseProfile({ ...base, fullName: "  Laura   Gómez  ", docNumber: "1.036.123.456", phone: "+57 300-123-4567", city: " Medellín " });
    expect(r).toEqual({
      ok: true,
      value: { fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín" },
    });
  });

  it("pide nombre y apellido a las personas", () => {
    expect(errors({ ...base, fullName: "Laura" }).fullName).toMatch(/apellido/i);
  });

  it("valida la cédula", () => {
    expect(errors({ ...base, docNumber: "12" }).docNumber).toBeDefined();
    expect(errors({ ...base, docNumber: "12a45678" }).docNumber).toBeDefined();
  });

  it("acepta pasaporte alfanumérico y lo pasa a mayúsculas", () => {
    const r = parseProfile({ ...base, docType: "PP", docNumber: "ab123456" });
    expect(r.ok && r.value.docNumber).toBe("AB123456");
  });

  it("calcula y verifica el dígito de verificación del NIT", () => {
    expect(nitCheckDigit("899999068")).toBe(1);
    expect(nitCheckDigit("890903938")).toBe(8);
    expect(nitCheckDigit("900123456")).toBe(8);
    const company = { ...base, docType: "NIT", fullName: "Energía Andina S.A.S." };
    const ok = parseProfile({ ...company, docNumber: "900.123.456-8" });
    expect(ok.ok && ok.value.docNumber).toBe("900123456-8");
    expect(errors({ ...company, docNumber: "900123456-7" }).docNumber).toMatch(/verificación/i);
    expect(parseProfile({ ...company, docNumber: "900123456" }).ok).toBe(true);
  });

  it("acepta celulares y fijos de Colombia de 10 dígitos", () => {
    expect(parseProfile({ ...base, phone: "604 444 5555" }).ok).toBe(true);
    expect(errors({ ...base, phone: "12345" }).phone).toBeDefined();
    expect(errors({ ...base, phone: "2001234567" }).phone).toBeDefined();
  });

  it("exige aceptar los términos y la política de datos", () => {
    expect(errors({ ...base, acceptTerms: false }).acceptTerms).toBeDefined();
  });

  it("rechaza un tipo de documento desconocido", () => {
    expect(errors({ ...base, docType: "XX" }).docType).toBeDefined();
  });
});
