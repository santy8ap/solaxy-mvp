/**
 * Filtro de las peticiones a /api, antes de llegar a las rutas (lo usa src/proxy.ts).
 * - Las que cambian datos (POST, PUT, PATCH, DELETE) solo se aceptan desde la propia página:
 *   un sitio ajeno no puede usar la sesión de alguien para pedir un retiro o cambiar sus datos (CSRF).
 * - Ningún cuerpo puede pasar de 100 KB.
 * Sin dependencias del servidor: corre en el proxy.
 */
export const MAX_BODY_BYTES = 100_000;

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Los avisos de Mercado Pago llegan de sus servidores (van firmados) y el ingreso (Better Auth)
// verifica el origen por su cuenta.
const OWN_CHECKS = ["/api/webhooks/", "/api/auth/"];

export interface GuardInput {
  method: string;
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  contentLength: string | null;
  /** Orígenes de confianza además del propio (la URL pública configurada) */
  extraOrigins: string[];
}

export type GuardResult = { ok: true } | { ok: false; status: number; error: string };

export function guardApiRequest(r: GuardInput): GuardResult {
  if (Number(r.contentLength ?? 0) > MAX_BODY_BYTES) return { ok: false, status: 413, error: "La solicitud es demasiado grande." };
  if (!UNSAFE.has(r.method.toUpperCase()) || OWN_CHECKS.some((p) => r.pathname.startsWith(p))) return { ok: true };
  const allowed = new Set(r.extraOrigins);
  if (r.host) {
    allowed.add(`https://${r.host}`);
    allowed.add(`http://${r.host}`);
  }
  if (r.origin) {
    if (allowed.has(r.origin)) return { ok: true };
    return { ok: false, status: 403, error: "Origen no permitido." };
  }
  // Sin Origin: un navegador que avisa que viene de otro sitio no pasa; un cliente sin navegador no lleva la sesión de nadie.
  if (r.secFetchSite === "cross-site") return { ok: false, status: 403, error: "Origen no permitido." };
  return { ok: true };
}
