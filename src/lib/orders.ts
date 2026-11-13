import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { alertPaymentConfirmed, alertPaymentToRefund } from "@/lib/alerts";
import { db, type DbSession } from "@/lib/db";
import { writeTransaction } from "@/lib/db/transaction";
import { ledgerTx, type PaymentMethod, type TxStatus } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { payLog } from "@/lib/payments/log";
import { activatePeriod } from "@/lib/plans/service";
import { readConfig } from "@/lib/settings";

/**
 * Órdenes de pago de un mes de un plan, y la activación de la energía cuando el pago se confirma.
 * La activación es idempotente: un UPDATE condicional reclama la orden, así que el mes se activa
 * una sola vez aunque la notificación y la consulta lleguen al mismo tiempo.
 */

export type OrderRow = typeof ledgerTx.$inferSelect;

/** Estados desde los que una orden todavía puede confirmarse. */
const OPEN: TxStatus[] = ["pendiente", "verificando"];

/**
 * Estados cerrados que un pago real todavía puede reabrir: un intento rechazado seguido de uno aprobado, o una
 * orden que se canceló por abandono y cuyo pago llegó después.
 */
export const REOPENABLE: TxStatus[] = ["fallida", "cancelada"];

/** Pasarelas con dinero real (el pago de prueba no cuenta). */
export const REAL_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "mercadopago",
  "crypto",
  "manual",
  "transferencia",
];

/** Cuánto vive una orden de Mercado Pago sin pagar antes de considerarse abandonada. */
export const ORDER_TTL_MS = 30 * 60_000;

export async function getOrder(
  orderId: string,
  session: DbSession = db,
): Promise<OrderRow | undefined> {
  const [row] = await session
    .select()
    .from(ledgerTx)
    .where(eq(ledgerTx.id, orderId));
  return row;
}

export interface PaymentProof {
  providerId?: string | null;
  providerStatus?: string | null;
  txHash?: string | null;
  signature?: string | null;
}

const proofFields = (p: PaymentProof) => ({
  ...(p.providerId !== undefined && { providerId: p.providerId }),
  ...(p.providerStatus !== undefined && { providerStatus: p.providerStatus }),
  ...(p.txHash !== undefined && { txHash: p.txHash }),
  ...(p.signature !== undefined && { signature: p.signature }),
});

/** Cierra una orden abierta (fallida, por reembolsar…) sin activar nada. Devuelve la fila o undefined si ya no estaba abierta. */
export async function closeOrder(
  orderId: string,
  status: TxStatus,
  data: PaymentProof & { note: string },
  from: TxStatus[] = OPEN,
) {
  const [row] = await db
    .update(ledgerTx)
    .set({ status, note: data.note, ...proofFields(data) })
    .where(and(eq(ledgerTx.id, orderId), inArray(ledgerTx.status, from)))
    .returning();
  if (row)
    payLog("orden_cerrada", {
      orderId,
      status,
      motivo: data.note,
      proveedor: row.method,
      providerId: row.providerId,
    });
  return row;
}

/**
 * Guarda lo último que dijo el proveedor (y opcionalmente cambia el estado) sin cerrar la orden.
 * `from`: desde qué estados; por defecto, solo órdenes abiertas. Con `note: null` se borra la nota anterior
 * (por ejemplo, al reabrir una orden cancelada).
 */
export async function markProviderStatus(
  orderId: string,
  data: PaymentProof & { status?: TxStatus; note?: string | null },
  from: TxStatus[] = OPEN,
) {
  const [row] = await db
    .update(ledgerTx)
    .set({
      ...proofFields(data),
      ...(data.status && { status: data.status }),
      ...(data.note !== undefined && { note: data.note }),
    })
    .where(and(eq(ledgerTx.id, orderId), inArray(ledgerTx.status, from)))
    .returning();
  return row;
}

export type FulfillOutcome =
  | "confirmada"
  | "ya_confirmada"
  | "no_activada"
  | "cerrada";

const NOT_ACTIVATED: Record<
  "sin_cupo" | "mes_pagado" | "plan_cerrado" | "plan_en_revision",
  string
> = {
  sin_cupo: "La planta se quedó sin cupo para este plan.",
  mes_pagado: "Este mes del plan ya estaba pagado.",
  plan_cerrado: "El plan ya estaba cerrado cuando se confirmó el pago.",
  plan_en_revision: "El plan tiene una devolución pendiente de conciliación.",
};

/**
 * Activa el mes de energía de una orden pagada. Idempotente.
 * `reopen`: estados cerrados que un pago aprobado puede reabrir (p. ej. un intento rechazado en
 * Mercado Pago seguido de uno aprobado para la misma orden).
 */
export async function fulfillOrder(
  orderId: string,
  proof: PaymentProof = {},
  { now = Date.now(), reopen = [] as TxStatus[] } = {},
): Promise<{ outcome: FulfillOutcome; order: OrderRow }> {
  // La configuración se lee antes de abrir la transacción; dentro no hay red ni otra conexión.
  const { plantDailyKwh } = await readConfig();
  const result = await writeTransaction(
    async (session): Promise<{ outcome: FulfillOutcome; order: OrderRow }> => {
      const tx = await getOrder(orderId, session);
      if (!tx || tx.kind !== "plan_mes")
        throw new MarketError("Orden no encontrada", 404);
      if (tx.status === "confirmada")
        return { outcome: "ya_confirmada", order: tx };
      const claimable = [...OPEN, ...reopen];
      if (!claimable.includes(tx.status))
        return { outcome: "cerrada", order: tx };

      const [order] = await session
        .update(ledgerTx)
        .set({
          status: "confirmada",
          confirmedAt: now,
          note: null,
          ...proofFields(proof),
        })
        .where(
          and(eq(ledgerTx.id, orderId), inArray(ledgerTx.status, claimable)),
        )
        .returning();
      if (!order) {
        const current = (await getOrder(orderId, session)) ?? tx;
        return {
          outcome:
            current.status === "confirmada" ? "ya_confirmada" : "cerrada",
          order: current,
        };
      }

      // Confirmación, periodo y fecha de inicio se guardan juntos o se revierten juntos.
      // Un error de base de datos conserva la orden abierta para el reintento del proveedor.
      const activation = await activatePeriod(order, now, {
        session,
        plantDailyKwh,
      });
      if (activation !== "activado") {
        const real = REAL_PAYMENT_METHODS.includes(
          order.method as PaymentMethod,
        );
        const [reverted] = await session
          .update(ledgerTx)
          .set({
            status: real ? "por_reembolsar" : "fallida",
            confirmedAt: null,
            note: `${NOT_ACTIVATED[activation]}${real ? " Hay que devolver el pago." : ""}`,
          })
          .where(eq(ledgerTx.id, orderId))
          .returning();
        return { outcome: "no_activada", order: reverted };
      }
      return { outcome: "confirmada", order };
    },
  );
  const { order } = result;
  if (result.outcome === "confirmada") alertPaymentConfirmed(order);
  else if (result.outcome === "no_activada" && order.status === "por_reembolsar") alertPaymentToRefund(order);
  if (result.outcome === "confirmada")
    payLog("mes_activado", {
      orderId,
      userId: order.userId,
      plan: order.subscriptionId,
      mes: order.periodIndex,
      kwh: order.kwh,
      amountCop: order.amountCop,
      proveedor: order.method,
      providerId: order.providerId,
    });
  else if (result.outcome === "no_activada")
    payLog("orden_no_activada", {
      orderId,
      motivo: order.note,
      status: order.status,
      proveedor: order.method,
    });
  return result;
}
