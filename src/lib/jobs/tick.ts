import "server-only";
import { lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { jobState } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { payLog } from "@/lib/payments/log";
import { reconcileMercadoPago } from "./reconcile-mercadopago";
import { reconcilePayments } from "./reconcile-payments";

const TICK_ID = "reconcile-tick";
/** Como máximo una pasada cada 2 minutos en todo el sitio, sin importar cuántas visitas lleguen. */
export const TICK_INTERVAL_MS = 2 * 60_000;

/** La pasada frecuente: pagos cripto en verificación y pagos pendientes de Mercado Pago. */
async function frequentPass() {
  await reconcilePayments();
  await reconcileMercadoPago({ mode: "frecuente" });
}

/**
 * Conciliación con las visitas: las rutas que se consultan a menudo la llaman con after(), así que
 * corre después de responder y no demora a nadie. Así un pago no espera al cron diario cuando la
 * empresa cerró la página. Devuelve si le tocó correr. Nunca lanza errores.
 */
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

/** Cada instancia consulta la base como máximo cada 30 segundos (evita una escritura por visita). */
const LOCAL_CHECK_MS = 30_000;
const memo = globalThis as unknown as { __iweTickNextCheck?: number };

export async function maybeReconcile({ clock = Date.now, run = frequentPass }: { clock?: () => number; run?: () => Promise<void> } = {}) {
  const now = clock();
  if (memo.__iweTickNextCheck && now < memo.__iweTickNextCheck) return false;
  memo.__iweTickNextCheck = now + LOCAL_CHECK_MS;
  try {
    if (!(await claimInterval({ id: TICK_ID, intervalMs: TICK_INTERVAL_MS, clock: () => now }))) return false;
    try {
      await run();
    } catch (error) {
      payLog("conciliacion_visitas_fallida", { error: String(error).slice(0, 200) });
    }
    return true;
  } catch (error) {
    payLog("conciliacion_visitas_fallida", { error: String(error).slice(0, 200) });
    return false;
  }
}
