import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { ensureReady } from "@/lib/db/init";
import { jsonError, knownSession, unauthorized, type CurrentUser } from "@/lib/session";
import type { AdminRole } from "./roles";
import { adminRoleOf } from "./team";

/**
 * Quién administra: se entra con Google y el correo de la cuenta decide. Los propietarios son los correos de
 * ADMIN_EMAILS (Vercel); el resto del equipo lo eligen ellos en Admin › Equipo. No hay PIN: la protección es la
 * cuenta de Google de cada persona (con su verificación en dos pasos). El rol se consulta en cada petición, así
 * que quitarle el acceso a alguien vale de inmediato, aunque tenga la sesión abierta.
 */
export interface AuthContext {
  user: CurrentUser;
  isAdmin: boolean;
  role: AdminRole | null;
}

/** Sesión actual y su rol de administración. */
export async function getAuthContext(): Promise<AuthContext | null> {
  await connection();
  const h = await headers();
  await ensureReady();
  const s = await auth.api.getSession({ headers: h });
  if (!s?.user || !s.session || !(await knownSession(s.user.id, s.session.id))) return null;
  const role = await adminRoleOf(s.user.email);
  return {
    user: { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null },
    isAdmin: role !== null,
    role,
  };
}

/** Para las rutas /api/admin/*: devuelve el contexto o una respuesta de error. */
export async function requireAdminApi(): Promise<AuthContext | Response> {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!ctx.isAdmin) return jsonError("Tu cuenta no tiene acceso a la administración.", 403);
  return ctx;
}

/** Solo los propietarios: cambiar el equipo de administración. */
export async function requireOwnerApi(): Promise<AuthContext | Response> {
  const ctx = await requireAdminApi();
  if (ctx instanceof Response) return ctx;
  if (ctx.role !== "propietario") return jsonError("Solo un propietario puede cambiar el equipo de administración.", 403);
  return ctx;
}
