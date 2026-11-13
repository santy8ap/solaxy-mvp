import "server-only";
import { eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { jobState } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

/**
 * Reclama un turno en la base: true si pasó `intervalMs` desde el último turno de `id` (en todo el sitio,
 * entre instancias). Una sola sentencia, así que dos solicitudes simultáneas no obtienen el mismo turno.
 */
export async function claimInterval({ id, intervalMs, clock = Date.now }: { id: string; intervalMs: number; clock?: () => number }) {
  await ensureReady();
  const now = clock();
  const [claimed] = await db
    .insert(jobState)
    .values({ id, lockToken: newId("turno-"), lockedUntil: now + intervalMs, updatedAt: now })
    .onConflictDoUpdate({
      target: jobState.id,
      set: { lockToken: newId("turno-"), lockedUntil: now + intervalMs, updatedAt: now },
      setWhere: lte(jobState.lockedUntil, now),
    })
    .returning();
  return Boolean(claimed);
}

/** Dónde quedó una tarea que recorre filas por tandas: la siguiente pasada sigue desde ahí. */
export async function readCursor(id: string) {
  const [row] = await db.select({ cursor: jobState.cursor }).from(jobState).where(eq(jobState.id, id));
  return row?.cursor ?? null;
}

export async function saveCursor(id: string, cursor: string | null, now = Date.now()) {
  await db
    .insert(jobState)
    .values({ id, lockToken: "cursor", lockedUntil: 0, cursor, updatedAt: now })
    .onConflictDoUpdate({ target: jobState.id, set: { cursor, updatedAt: now } });
}
