import "server-only";
import { and, eq, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { alertFailure } from "@/lib/alerts";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx, session, verification } from "@/lib/db/schema";
import { payLog } from "@/lib/payments/log";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { claimInterval } from "./claim";
import { sendPlanReminders } from "./reminders";

/**
 * Mantenimiento: cierra lo que quedó abierto y ya nadie va a completar, y borra lo vencido que no sirve.
 * Sin esto, un pago que se abandona en el checkout queda «sin pagar» para siempre: el comercializador ve el
 * aviso de un pago pendiente que no existe y su cuenta no se puede eliminar.
 *
 * Cerrar no pierde dinero: si el pago de una orden cancelada llega tarde, Mercado Pago avisa y la orden se
 * reabre; y a una cotización cripto cancelada todavía se le puede registrar el hash.
 */

/** Sin pagar en Mercado Pago: la conciliación lo consulta durante 2 días; después se da por abandonado. */
export const MP_ABANDONED_MS = 2 * DAY_MS;
/** Cotización cripto sin hash: un día después de vencer. */
export const CRYPTO_ABANDONED_MS = DAY_MS;
/** Retiro a wallet que nunca se firmó (la firma vale 15 minutos). */
export const UNSIGNED_WITHDRAWAL_MS = DAY_MS;
/** Lo que lleva menos de una hora abierto puede estar pagándose ahora mismo: todavía está en curso. */
export const IN_FLIGHT_MS = HOUR_MS;

/**
 * Cierra como canceladas las órdenes sin pagar que ya vencieron. Con `userId` (antes de eliminar una cuenta)
 * cierra todo lo de esa cuenta que lleva más de una hora abierto. Nunca toca una orden con un pago en
 * proceso, en verificación o esperando al administrador.
 */
export async function closeAbandonedOrders({ now = Date.now(), userId }: { now?: number; userId?: string } = {}) {
  await ensureReady();
  const before = (ageMs: number) => now - (userId ? IN_FLIGHT_MS : ageMs);
  const close = async (where: SQL | undefined, note: string) => {
    const rows = await db
      .update(ledgerTx)
      .set({ status: "cancelada", note })
      .where(and(eq(ledgerTx.status, "pendiente"), isNull(ledgerTx.providerId), userId ? eq(ledgerTx.userId, userId) : undefined, where))
      .returning({ id: ledgerTx.id });
    return rows.length;
  };
  const plan = eq(ledgerTx.kind, "plan_mes");
  const result = {
    mercadopago: await close(and(plan, eq(ledgerTx.method, "mercadopago"), lt(ledgerTx.createdAt, before(MP_ABANDONED_MS))), "No se completó el pago en Mercado Pago."),
    crypto: await close(
      and(plan, eq(ledgerTx.method, "crypto"), lt(sql`coalesce(${ledgerTx.expiresAt}, ${ledgerTx.createdAt})`, before(CRYPTO_ABANDONED_MS))),
      "La cotización venció sin que se registrara un pago.",
    ),
    otros: await close(and(plan, inArray(ledgerTx.method, ["demo", "manual"]), lt(ledgerTx.createdAt, before(DAY_MS))), "El pago no se completó."),
    retiros: await close(and(eq(ledgerTx.kind, "retiro"), lt(ledgerTx.createdAt, before(UNSIGNED_WITHDRAWAL_MS))), "El retiro no se firmó desde la wallet a tiempo."),
  };
  if (result.mercadopago + result.crypto + result.otros + result.retiros > 0) payLog("ordenes_abandonadas_cerradas", { ...result, ...(userId && { userId }) });
  return result;
}

/** Borra las sesiones y las verificaciones de ingreso que vencieron hace más de un día: ya no abren nada. */
export async function purgeExpired({ now = Date.now() }: { now?: number } = {}) {
  await ensureReady();
  const cutoff = new Date(now - DAY_MS);
  const sessions = await db.delete(session).where(lt(session.expiresAt, cutoff)).returning({ id: session.id });
  const verifications = await db.delete(verification).where(lt(verification.expiresAt, cutoff)).returning({ id: verification.id });
  return { sessions: sessions.length, verifications: verifications.length };
}

export async function runHousekeeping({ now = Date.now() }: { now?: number } = {}) {
  const orders = await closeAbandonedOrders({ now });
  const expired = await purgeExpired({ now });
  // Recordatorios por correo de mensualidades y planes (solo si los correos a los clientes están activos).
  const reminders = await sendPlanReminders({ now });
  return { orders, expired, reminders };
}

/**
 * Con las visitas: como máximo una vez por hora en todo el sitio (además del cron diario). Devuelve si le tocó
 * correr. Nunca lanza errores.
 */
export async function maybeHousekeeping({ clock = Date.now, run = () => runHousekeeping({ now: clock() }) }: { clock?: () => number; run?: () => Promise<unknown> } = {}) {
  const failed = (error: unknown) => {
    payLog("mantenimiento_fallido", { error: String(error).slice(0, 200) });
    alertFailure("mantenimiento", "el mantenimiento automático", String(error));
  };
  try {
    if (!(await claimInterval({ id: "mantenimiento", intervalMs: HOUR_MS, clock }))) return false;
    await run().catch(failed);
    return true;
  } catch (error) {
    failed(error);
    return false;
  }
}
