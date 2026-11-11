import "server-only";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { ensureReady } from "@/lib/db/init";
import { adminEmailAllowed, adminPin, authSecret, baseUrl } from "@/lib/env";
import { jsonError, knownUser, unauthorized, type CurrentUser } from "@/lib/session";
import { verifyPinAttempt } from "./pin-attempts";
import { sessionBinding, signAdminToken, verifyAdminToken } from "./token";

export const ADMIN_COOKIE = "iwe-admin";
export const INTENT_COOKIE = "iwe-admin-intent";
const ADMIN_TTL_MS = 12 * 60 * 60_000;
const INTENT_TTL_MS = 10 * 60_000;


const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  // Segura en producción y siempre que la página se sirva por https.
  secure: process.env.NODE_ENV === "production" || baseUrl().startsWith("https://"),
  path: "/",
  maxAge: Math.floor(maxAgeMs / 1000),
});

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/**
 * Verifica el PIN: 5 intentos fallidos por minuto, por cuenta y por IP, y luego un minuto de espera.
 * `account` identifica a quién se le prueba el PIN (la cuenta con sesión, o la de pruebas).
 */
export async function checkAdminPin(pin: string, account?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const expected = adminPin();
  if (!expected) return { ok: false, error: "El acceso de administrador no está configurado (falta ADMIN_PIN)." };
  await ensureReady();
  // Antes de iniciar sesión (camino de Google) solo se conoce la IP.
  const ip = `ip:${await clientKey()}`;
  const r = await verifyPinAttempt({ pin, expected, keys: account ? [`cuenta:${account}`, ip] : [ip] });
  if (r.ok) return { ok: true };
  if (r.locked) return { ok: false, error: `Demasiados intentos. Espera ${r.retryAfterSec ?? 60} segundos e inténtalo de nuevo.` };
  return { ok: false, error: "El PIN no es correcto." };
}

/** Activa el modo administrador para esta sesión (cookie firmada y atada a la sesión). */
export async function grantAdmin(userId: string, sessionToken: string) {
  const c = await cookies();
  const token = signAdminToken({ userId, binding: sessionBinding(sessionToken), exp: Date.now() + ADMIN_TTL_MS }, authSecret());
  c.set(ADMIN_COOKIE, token, cookieOptions(ADMIN_TTL_MS));
  c.delete(INTENT_COOKIE);
}

/** Antes de ir a Google: recuerda por 10 min que el PIN ya se validó. */
export async function setAdminIntent() {
  const c = await cookies();
  const token = signAdminToken({ userId: "intent", binding: "intent", exp: Date.now() + INTENT_TTL_MS }, authSecret());
  c.set(INTENT_COOKIE, token, cookieOptions(INTENT_TTL_MS));
}

export async function hasAdminIntent() {
  const token = (await cookies()).get(INTENT_COOKIE)?.value;
  return verifyAdminToken(token, { userId: "intent", binding: "intent", now: Date.now() }, authSecret());
}

export async function clearAdmin() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
  c.delete(INTENT_COOKIE);
}

export interface AuthContext {
  user: CurrentUser;
  isAdmin: boolean;
  sessionToken: string;
}

/** Sesión actual y si está en modo administrador. */
export async function getAuthContext(): Promise<AuthContext | null> {
  await connection();
  const h = await headers();
  await ensureReady();
  const s = await auth.api.getSession({ headers: h });
  if (!s?.user || !s.session || !(await knownUser(s.user.id))) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  // Con dinero real, además de la cookie firmada, el correo debe estar autorizado (ADMIN_EMAILS).
  const isAdmin =
    adminEmailAllowed(s.user.email) &&
    verifyAdminToken(token, { userId: s.user.id, binding: sessionBinding(s.session.token), now: Date.now() }, authSecret());
  return {
    user: { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null },
    isAdmin,
    sessionToken: s.session.token,
  };
}

/** Para las rutas /api/admin/*: devuelve el contexto o una respuesta de error. */
export async function requireAdminApi(): Promise<AuthContext | Response> {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!ctx.isAdmin) return jsonError("Necesitas entrar como administrador (con el PIN).", 403);
  return ctx;
}
