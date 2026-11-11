import { describe, expect, it } from "vitest";
import { cleanText, safeText } from "@/lib/security/text";

describe("limpieza de textos escritos por personas", () => {
  it("quita caracteres de control e invisibles y normaliza espacios", () => {
    expect(cleanText("  Pago\u0000 de   prueba\n\t ")).toBe("Pago de prueba");
    // Caracteres que invierten la dirección del texto (sirven para disfrazar referencias).
    expect(cleanText("REF‮1234‬")).toBe("REF 1234");
    expect(cleanText("TRANS​FER﻿")).toBe("TRANS FER");
  });

  it("normaliza las tildes compuestas", () => {
    expect(cleanText("Medellín")).toBe("Medellín");
  });

  it("recorta al largo máximo", () => {
    expect(cleanText("a".repeat(500), 10)).toHaveLength(10);
  });

  it("los campos rechazan < y >, y exigen un largo mínimo después de limpiar", () => {
    const reason = safeText(200, { min: 4, label: "El motivo" });
    expect(reason.safeParse("  El banco devolvió   el pago ").data).toBe("El banco devolvió el pago");
    expect(reason.safeParse("<script>alert(1)</script>").success).toBe(false);
    expect(reason.safeParse("<img src=x onerror=alert(1)>").error?.issues[0].message).toMatch(/< ni >/);
    expect(reason.safeParse(" \u0000  ab ").success).toBe(false);
    expect(safeText(120).default("").parse(undefined)).toBe("");
  });
});
