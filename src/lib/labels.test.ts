import { describe, expect, it } from "vitest";
import { BRAND } from "@/config/brand";
import { isOrderCode, orderCode } from "@/lib/ids";
import { adminMethodLabel, paymentMethodLabel, txStatusLabel } from "@/lib/labels";
import { initialsOf } from "@/components/ui/avatar";
import { TX_STATUS } from "@/components/ui/status";

describe("los mismos nombres en la pantalla, los PDF y los CSV", () => {
  it("cada estado de la pantalla usa el nombre compartido", () => {
    for (const [status, { label }] of Object.entries(TX_STATUS)) expect(label).toBe(txStatusLabel(status));
    expect(txStatusLabel("por_aprobar")).toBe("En revisión");
    expect(txStatusLabel("desconocido")).toBe("desconocido");
  });

  it("medios de pago: para el comercializador y para el admin", () => {
    expect(paymentMethodLabel("mercadopago")).toBe("Mercado Pago");
    expect(paymentMethodLabel("manual")).toBe("Transferencia bancaria");
    expect(adminMethodLabel("manual")).toBe("Registrado a mano");
    expect(adminMethodLabel("transferencia")).toBe("Transferencia bancaria");
    expect(paymentMethodLabel(null)).toBe("");
  });
});

describe("códigos de orden", () => {
  it("llevan la sigla de la marca y siguen aceptando los de antes", () => {
    const code = orderCode();
    expect(code.startsWith(`${BRAND.shortName}-`)).toBe(true);
    expect(isOrderCode(code)).toBe(true);
    expect(isOrderCode("IWE-1A2B3C4D5E")).toBe(true);
    expect(isOrderCode("iwe-1a2b3c")).toBe(false);
    expect(isOrderCode("IWE-NOEXISTE")).toBe(false);
    expect(isOrderCode("../../admin")).toBe(false);
  });
});

describe("iniciales de la foto de perfil", () => {
  it("nombre y apellido, una palabra o nada", () => {
    expect(initialsOf("Laura Gómez")).toBe("LG");
    expect(initialsOf("  María  José   Restrepo  ")).toBe("MR");
    expect(initialsOf("Empresa")).toBe("E");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});
