import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDeletedEmail } from "@/lib/deleted-account";
import { ensureReady } from "@/lib/db/init";
import { user } from "@/lib/db/schema";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/**
 * ¿La cuenta existe en esta base y sigue activa? La cookie de sesión queda en caché 5 minutos: puede nombrar a
 * un usuario que aquí no existe (sin Turso, cada instancia de Vercel tiene su propia base temporal) o a una
 * cuenta eliminada a pedido del titular. En ambos casos se trata como sesión cerrada.
 */
export async function knownUser(id: string) {
  const [row] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, id)).limit(1);
  return Boolean(row) && !isDeletedEmail(row.email);
}

/** Usuario de la sesión actual o null. Prepara la base de datos si hace falta. */
export async function getSessionUser(): Promise<CurrentUser | null> {
  // connection(): esto ocurre solo al momento de la visita (usa la hora actual y la BD).
  await connection();
  const h = await headers();
  await ensureReady();
  const s = await auth.api.getSession({ headers: h });
  if (!s?.user || !(await knownUser(s.user.id))) return null;
  return { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const unauthorized = () => jsonError("Inicia sesión para continuar", 401);
