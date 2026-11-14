import { afterEach, describe, expect, it, vi } from "vitest";
import { goToLoginIfSignedOut, postJson, SESSION_CLOSED } from "./use-json";

/** Un navegador mínimo: la página actual y a dónde se la mandó. */
function browserAt(pathname: string, search = "") {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { pathname, search, replace } });
  return replace;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sesión cerrada al enviar una acción", () => {
  it("con 401 lleva a ingresar y luego de vuelta a la misma página", async () => {
    const replace = browserAt("/admin/pagos", "?estado=en_proceso");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Inicia sesión para continuar" }, { status: 401 })));
    await expect(postJson("/api/admin/payments/XGE-1", { action: "confirmar" })).rejects.toThrow(SESSION_CLOSED);
    expect(replace).toHaveBeenCalledWith(`/ingresar?${new URLSearchParams({ rol: "admin", next: "/admin/pagos?estado=en_proceso" })}`);
  });

  it("los demás errores se muestran como siempre, sin salir de la página", async () => {
    const replace = browserAt("/panel/billetera");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "No tienes saldo suficiente." }, { status: 409 })));
    await expect(postJson("/api/withdrawals", { amountCop: 1 })).rejects.toThrow("No tienes saldo suficiente.");
    expect(replace).not.toHaveBeenCalled();
    expect(goToLoginIfSignedOut(new Response(null, { status: 403 }))).toBe(false);
  });
});
