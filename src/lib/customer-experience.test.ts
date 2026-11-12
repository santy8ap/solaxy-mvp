import { describe, expect, it } from "vitest";
import { csvCell, csvLine } from "@/lib/csv";
import { colombiaDate, historyFilters } from "@/lib/history-filters";
import { loginHref, planCheckoutHref, safeReturnTo } from "@/lib/navigation";
import { assertExpectedPayment } from "@/lib/payments/plan-target";
import { SupportInput } from "@/lib/support-schema";
import { bogotaMs } from "@/lib/time";

describe("continuidad segura de la compra", () => {
  it("conserva el plan al ir al ingreso", () => {
    const destination = planCheckoutHref("p180");
    expect(
      new URL(loginHref(destination), "https://app.invalid").searchParams.get(
        "next",
      ),
    ).toBe("/comprar?plan=p180");
    expect(safeReturnTo(destination)).toBe(destination);
    expect(safeReturnTo("/panel/billetera?desde=2026-11-10")).toBe(
      "/panel/billetera?desde=2026-11-10",
    );
  });
  it("rechaza redirecciones externas, barras invertidas y destinos arbitrarios", () => {
    for (const destination of [
      "https://evil.invalid",
      "//evil.invalid",
      "/\\evil.invalid",
      "/admin",
      "/api/admin/activar",
      "/comprar\n",
      "/panel/../../admin",
    ])
      expect(safeReturnTo(destination)).toBeNull();
  });
});

describe("exportación y fechas", () => {
  it("escapa comillas y evita fórmulas de hojas de cálculo sin alterar importes numéricos", () => {
    expect(csvCell('Nombre "Comercializador"')).toBe(
      '"Nombre ""Comercializador"""',
    );
    expect(csvCell('=HYPERLINK("https://evil.invalid")')).toMatch(/^"'=/);
    expect(csvCell("  +SUM(1;2)")).toMatch(/^"'/);
    expect(csvCell(-50000)).toBe('"-50000"');
    expect(csvLine(["Pago", 20880000, null])).toBe('"Pago";"20880000";""\r\n');
  });
  it("usa días completos de Colombia y rechaza fechas inexistentes", () => {
    expect(colombiaDate("2026-11-10")).toBe(bogotaMs(2026, 11, 10));
    expect(
      historyFilters(new URLSearchParams("desde=2026-11-10&hasta=2026-11-10")),
    ).toMatchObject({
      from: bogotaMs(2026, 11, 10),
      until: bogotaMs(2026, 11, 11),
      page: 1,
    });
    expect(() => colombiaDate("2026-02-30")).toThrow();
    expect(() =>
      historyFilters(new URLSearchParams("desde=2026-11-11&hasta=2026-11-10")),
    ).toThrow();
    expect(() => historyFilters(new URLSearchParams("pagina=-1"))).toThrow();
  });
});

describe("precios revisados antes de pagar", () => {
  const current = { amountCop: 20880000, saleCopPerKwh: 400 };
  it("admite lo revisado y conserva compatibilidad con clientes anteriores", () => {
    expect(() =>
      assertExpectedPayment(current, {
        expectedAmountCop: 20880000,
        expectedSaleCopPerKwh: 400,
      }),
    ).not.toThrow();
    expect(() => assertExpectedPayment(current, {})).not.toThrow();
  });
  it("exige revisar de nuevo si cambió el importe o el precio de venta", () => {
    expect(() =>
      assertExpectedPayment(current, { expectedAmountCop: 20000000 }),
    ).toThrow(/actualizaron/);
    expect(() =>
      assertExpectedPayment(current, { expectedSaleCopPerKwh: 420 }),
    ).toThrow(/actualizaron/);
  });
});

describe("contactos oficiales de soporte", () => {
  it("normaliza el contacto y permite dejar un canal sin publicar", () => {
    expect(
      SupportInput.parse({
        email: " SOPORTE@example.com ",
        whatsapp: "+57 300 123 4567",
      }),
    ).toEqual({ email: "soporte@example.com", whatsapp: "573001234567" });
    expect(SupportInput.parse({ email: "", whatsapp: "" })).toEqual({
      email: "",
      whatsapp: "",
    });
  });
  it("no acepta plantillas ni direcciones con saltos de línea", () => {
    expect(
      SupportInput.safeParse({ email: "[correo de soporte]", whatsapp: "" })
        .success,
    ).toBe(false);
    expect(
      SupportInput.safeParse({
        email: "a@example.com\nBcc:other@example.com",
        whatsapp: "",
      }).success,
    ).toBe(false);
    expect(SupportInput.safeParse({ email: "", whatsapp: "123" }).success).toBe(
      false,
    );
  });
});
