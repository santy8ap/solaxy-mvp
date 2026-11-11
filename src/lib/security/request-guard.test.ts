import { describe, expect, it } from "vitest";
import { guardApiRequest } from "@/lib/security/request-guard";

const base = { method: "POST", pathname: "/api/withdrawals", host: "solaxy-mvp.vercel.app", origin: "https://solaxy-mvp.vercel.app", secFetchSite: "same-origin", contentLength: "120", extraOrigins: [] as string[] };

describe("filtro de las peticiones a la API (origen y tamaño)", () => {
  it("deja pasar las peticiones de la propia página", () => {
    expect(guardApiRequest(base)).toEqual({ ok: true });
  });

  it("rechaza peticiones que cambian datos desde otro sitio (CSRF)", () => {
    expect(guardApiRequest({ ...base, origin: "https://sitio-malicioso.com", secFetchSite: "cross-site" })).toMatchObject({ ok: false, status: 403 });
    expect(guardApiRequest({ ...base, method: "PUT", pathname: "/api/profile", origin: "https://otro.vercel.app", secFetchSite: "cross-site" })).toMatchObject({ ok: false, status: 403 });
    // Aunque falte el encabezado Origin, el navegador avisa que viene de otro sitio.
    expect(guardApiRequest({ ...base, origin: null, secFetchSite: "cross-site" })).toMatchObject({ ok: false, status: 403 });
  });

  it("acepta orígenes configurados (la URL pública) y clientes sin navegador", () => {
    expect(guardApiRequest({ ...base, origin: "https://inworldenergy.co", secFetchSite: "cross-site", extraOrigins: ["https://inworldenergy.co"] })).toEqual({ ok: true });
    expect(guardApiRequest({ ...base, origin: null, secFetchSite: null })).toEqual({ ok: true });
  });

  it("las lecturas no se bloquean por origen (no cambian datos)", () => {
    expect(guardApiRequest({ ...base, method: "GET", pathname: "/api/plans", origin: "https://otro.com", secFetchSite: "cross-site" })).toEqual({ ok: true });
  });

  it("los avisos de Mercado Pago y el ingreso tienen su propia verificación", () => {
    expect(guardApiRequest({ ...base, pathname: "/api/webhooks/mercadopago", origin: null, secFetchSite: null })).toEqual({ ok: true });
    expect(guardApiRequest({ ...base, pathname: "/api/auth/sign-in/social", origin: "https://otro.com", secFetchSite: "cross-site" })).toEqual({ ok: true });
  });

  it("rechaza cuerpos de más de 100 KB", () => {
    expect(guardApiRequest({ ...base, contentLength: "100001" })).toMatchObject({ ok: false, status: 413 });
    expect(guardApiRequest({ ...base, contentLength: "99999" })).toEqual({ ok: true });
  });
});
