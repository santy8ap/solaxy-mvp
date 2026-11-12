import { describe, expect, it } from "vitest";
import { privateUrl } from "@/components/analytics/vercel";

describe("lo que se envía a la analítica de Vercel", () => {
  it("las páginas públicas y del comercializador van sin parámetros", () => {
    expect(privateUrl("https://solaxy-mvp.vercel.app/")).toBe("https://solaxy-mvp.vercel.app/");
    expect(privateUrl("https://solaxy-mvp.vercel.app/comprar?plan=p180")).toBe("https://solaxy-mvp.vercel.app/comprar");
    expect(privateUrl("https://solaxy-mvp.vercel.app/pagos/resultado?ref=IWE-12345ABCDE&status=approved")).toBe("https://solaxy-mvp.vercel.app/pagos/resultado");
    expect(privateUrl("https://solaxy-mvp.vercel.app/panel/billetera#historial")).toBe("https://solaxy-mvp.vercel.app/panel/billetera");
  });

  it("el admin y la API no se miden", () => {
    expect(privateUrl("https://solaxy-mvp.vercel.app/admin")).toBeNull();
    expect(privateUrl("https://solaxy-mvp.vercel.app/admin/pagos?estado=todos")).toBeNull();
    expect(privateUrl("https://solaxy-mvp.vercel.app/api/config")).toBeNull();
    expect(privateUrl("https://solaxy-mvp.vercel.app/administracion")).toBe("https://solaxy-mvp.vercel.app/administracion");
    expect(privateUrl("no es una url")).toBeNull();
  });
});
