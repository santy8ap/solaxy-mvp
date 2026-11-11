import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { alertReversal } from "@/lib/alerts";
import { writeTransaction } from "@/lib/db/transaction";
import {
  adminAudit,
  ledgerTx,
  paymentReview,
  planPeriod,
} from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { newId } from "@/lib/ids";

/** Se incluye en las escrituras de retiros: una devolución concurrente también bloquea el envío. */
export const noPaymentReviewSql = (userId: string) => sql`NOT EXISTS (
  SELECT 1 FROM payment_review WHERE user_id = ${userId} AND resolved_at IS NULL
)`;

export async function requireNoPaymentReview(userId: string) {
  const [open] = await db
    .select({ id: paymentReview.paymentId })
    .from(paymentReview)
    .where(
      and(eq(paymentReview.userId, userId), isNull(paymentReview.resolvedAt)),
    )
    .limit(1);
  if (open)
    throw new MarketError(
      "Hay una devolución en revisión. Contacta a soporte para conciliarla antes de hacer retiros o nuevos pagos del paquete.",
      409,
    );
}

/**
 * Solo recibe estados devueltos obtenidos de la API autenticada del proveedor.
 * Avisa al admin por correo la primera vez que el pago pasa a devuelto (los reintentos no repiten el aviso).
 */
export async function recordPaymentReversal(
  orderId: string,
  providerId: string,
  providerStatus: string,
  now = Date.now(),
) {
  const result = await writeTransaction(async (session) => {
    const [order] = await session
      .select()
      .from(ledgerTx)
      .where(eq(ledgerTx.id, orderId));
    if (!order || order.method !== "mercadopago") return;
    // Un intento distinto no puede invalidar el pago que activó el mes.
    if (order.providerId && order.providerId !== providerId) return;
    const [period] = await session
      .select()
      .from(planPeriod)
      .where(eq(planPeriod.txId, order.id));
    const [existing] = await session
      .select()
      .from(paymentReview)
      .where(eq(paymentReview.paymentId, order.id));
    const note = existing
      ? order.note
      : period
        ? "El proveedor devolvió o desconoció este pago. El período afectado dejó de generar energía; la cuenta requiere conciliación antes de retirar."
        : "El proveedor devolvió o desconoció el pago. No se activó energía con esta operación.";
    await session
      .update(ledgerTx)
      .set({ status: "reembolsada", providerId, providerStatus, note })
      .where(eq(ledgerTx.id, order.id));
    const changed = order.status !== "reembolsada";
    if (!period || !order.subscriptionId) return { order, changed, stoppedEnergy: false };
    const [inserted] = await session
      .insert(paymentReview)
      .values({
        paymentId: order.id,
        userId: order.userId,
        subscriptionId: order.subscriptionId,
        occurredAt: now,
        reason: providerStatus,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted)
      await session.insert(adminAudit).values({
        id: newId("aud-"),
        actorUserId: "system:mercadopago",
        actorName: "Mercado Pago",
        action: "devolucion_proveedor",
        targetUserId: order.userId,
        summary: `Devolución verificada del pago ${order.id}; requiere conciliación.`,
        detail: JSON.stringify({
          orderId,
          providerId,
          providerStatus,
          stoppedAt: now,
        }),
        createdAt: now,
      });
    return { order, changed, stoppedEnergy: true };
  });
  if (result?.changed) alertReversal(result.order, providerStatus, result.stoppedEnergy);
  return result;
}

/** Constancia de una conciliación hecha por el equipo; no envía dinero ni modifica rendimientos pasados. */
export async function resolvePaymentReview(
  actor: { id: string; name: string },
  orderId: string,
  reference: string,
) {
  const ref = reference.trim();
  if (ref.length < 12 || ref.length > 500)
    throw new MarketError(
      "Describe la conciliación y su referencia (12 a 500 caracteres).",
    );
  const now = Date.now();
  await writeTransaction(async (session) => {
    const [review] = await session
      .update(paymentReview)
      .set({ resolvedAt: now, resolutionReference: ref })
      .where(
        and(
          eq(paymentReview.paymentId, orderId),
          isNull(paymentReview.resolvedAt),
        ),
      )
      .returning();
    if (!review)
      throw new MarketError(
        "La devolución ya fue conciliada o no tiene una revisión pendiente.",
        409,
      );
    const [order] = await session
      .select()
      .from(ledgerTx)
      .where(eq(ledgerTx.id, orderId));
    await session
      .update(ledgerTx)
      .set({ note: `${order.note ?? ""} Conciliación registrada: ${ref}` })
      .where(eq(ledgerTx.id, orderId));
    await session.insert(adminAudit).values({
      id: newId("aud-"),
      actorUserId: actor.id,
      actorName: actor.name,
      action: "conciliar_devolucion",
      targetUserId: review.userId,
      summary: `Concilió la devolución del pago ${orderId}: ${ref}`,
      detail: JSON.stringify({ orderId, reference: ref }),
      createdAt: now,
    });
  });
}
