import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureReady } from "@/lib/db/init";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Usuario de la sesión actual o null. Prepara la base de datos si hace falta. */
export async function getSessionUser(): Promise<CurrentUser | null> {
  await ensureReady();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user) return null;
  return { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const unauthorized = () => jsonError("Inicia sesión para continuar", 401);
