import "server-only";
import { and, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx, listing, positionEntry, type TxStatus } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { payLog } from "@/lib/payments/log";
import { getKwPosition, round1 } from "@/lib/portfolio";

/**
 * Órdenes de compra: qué se compra, y la asignación de los kW cuando el pago se confirma.
 * La asignación es idempotente: un UPDATE condicional reclama la orden, así que los kW
 * se asignan una sola vez aunque el webhook y la consulta lleguen al mismo tiempo.
 */

export type OrderRow = typeof ledgerTx.$inferSelect;

/** Estados desde los que una orden todavía puede confirmarse. */
const OPEN: TxStatus[] = ["pendiente", "verificando"];

/** Mientras alguien paga una oferta P2P con Wompi o cripto, queda apartada este tiempo. */
export const LISTING_HOLD_MS = 30 * 60_000;

/** kW vendidos por la plataforma (suma de todas las posiciones). */
export async function soldKw() {
  const [r] = await db
    .select({ kw: sql<number>`coalesce(sum(${positionEntry.kwDelta}), 0)` })
    .from(positionEntry)
    .where(eq(positionEntry.plantId, PLANT.id));
  return round1(r.kw);
}

export interface Purchase {
  kind: "compra" | "compra_p2p";
  kw: number;
  pricePerKwCop: number;
  amountCop: number;
  listingId: string | null;
}

/** Valida qué se compra (a la planta o una oferta P2P) y calcula el precio. */
export async function resolvePurchase(userId: string, input: { kw?: number; listingId?: string }, now = Date.now()): Promise<Purchase> {
  const { spec, econ } = await ensureReady(now);
  if (input.listingId) {
    const [l] = await db.select().from(listing).where(eq(listing.id, input.listingId));
    if (!l || l.status !== "activa") throw new MarketError("Esa oferta ya no está disponible", 409);
    if (l.sellerId === userId) throw new MarketError("No puedes comprar tu propia oferta");
    const [busy] = await db
      .select({ id: ledgerTx.id })
      .from(ledgerTx)
      .where(
        and(
          eq(ledgerTx.listingId, l.id),
          inArray(ledgerTx.status, OPEN),
          inArray(ledgerTx.method, ["wompi", "crypto"]),
          gt(ledgerTx.expiresAt, now),
          ne(ledgerTx.userId, userId),
        ),
      )
      .limit(1);
    if (busy) throw new MarketError("Otra persona está pagando esta oferta en este momento. Intenta de nuevo en unos minutos.", 409);
    return { kind: "compra_p2p", kw: l.kw, pricePerKwCop: l.pricePerKwCop, amountCop: Math.round(l.kw * l.pricePerKwCop), listingId: l.id };
  }
  const kw = round1(input.kw ?? 0);
  if (kw < econ.minPurchaseKw || kw > econ.maxPurchaseKw) {
    throw new MarketError(`Puedes comprar entre ${econ.minPurchaseKw} y ${econ.maxPurchaseKw} kW`);
  }
  const available = spec.capacityKwp - (await soldKw());
  if (kw > available) throw new MarketError("La planta no tiene tantos kW disponibles", 409);
  return { kind: "compra", kw, pricePerKwCop: econ.pricePerKwCop, amountCop: Math.round(kw * econ.pricePerKwCop), listingId: null };
}

export async function getOrder(orderId: string): Promise<OrderRow | undefined> {
  const [row] = await db.select().from(ledgerTx).where(eq(ledgerTx.id, orderId));
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

/** Cierra una orden abierta (fallida, por reembolsar…) sin asignar kW. Devuelve la fila o undefined si ya no estaba abierta. */
export async function closeOrder(orderId: string, status: TxStatus, data: PaymentProof & { note: string }, from: TxStatus[] = OPEN) {
  const [row] = await db
    .update(ledgerTx)
    .set({ status, note: data.note, ...proofFields(data) })
    .where(and(eq(ledgerTx.id, orderId), inArray(ledgerTx.status, from)))
    .returning();
  if (row) payLog("orden_cerrada", { orderId, status, motivo: data.note, proveedor: row.method, providerId: row.providerId });
  return row;
}

/** Guarda lo último que dijo el proveedor (y opcionalmente cambia a "verificando") sin cerrar la orden. */
export async function markProviderStatus(orderId: string, data: PaymentProof & { status?: TxStatus }) {
  const [row] = await db
    .update(ledgerTx)
    .set({ ...proofFields(data), ...(data.status && { status: data.status }) })
    .where(and(eq(ledgerTx.id, orderId), inArray(ledgerTx.status, OPEN)))
    .returning();
  return row;
}

export type FulfillOutcome = "confirmada" | "ya_confirmada" | "sin_cupo" | "cerrada";

/**
 * Asigna los kW de una orden pagada. Idempotente.
 * `reopen`: estados cerrados que un pago aprobado puede reabrir (p. ej. un intento rechazado en Wompi
 * seguido de uno aprobado con la misma referencia).
 */
export async function fulfillOrder(
  orderId: string,
  proof: PaymentProof = {},
  { now = Date.now(), reopen = [] as TxStatus[] } = {},
): Promise<{ outcome: FulfillOutcome; order: OrderRow }> {
  const { spec } = await ensureReady(now);
  const tx = await getOrder(orderId);
  if (!tx || (tx.kind !== "compra" && tx.kind !== "compra_p2p")) throw new MarketError("Orden no encontrada", 404);
  if (tx.status === "confirmada") return { outcome: "ya_confirmada", order: tx };
  const claimable = [...OPEN, ...reopen];
  if (!claimable.includes(tx.status)) return { outcome: "cerrada", order: tx };

  const kw = tx.kw ?? 0;
  // Sin dinero de por medio (demo) basta con fallar; con un pago real hay que devolverlo.
  const unfulfilled: TxStatus = tx.method === "wompi" || tx.method === "crypto" ? "por_reembolsar" : "fallida";
  const refundNote = unfulfilled === "por_reembolsar" ? " Hay que devolver el pago." : "";

  if (!tx.listingId) {
    const available = spec.capacityKwp - (await soldKw());
    if (kw > available + 1e-9) {
      const closed = await closeOrder(orderId, unfulfilled, { ...proof, note: `La planta se quedó sin kW disponibles.${refundNote}` }, claimable);
      return { outcome: closed ? "sin_cupo" : "cerrada", order: closed ?? (await getOrder(orderId)) ?? tx };
    }
  }

  const claimed = await db
    .update(ledgerTx)
    .set({ status: "confirmada", confirmedAt: now, note: null, ...proofFields(proof) })
    .where(and(eq(ledgerTx.id, orderId), inArray(ledgerTx.status, claimable)))
    .returning();
  if (!claimed.length) {
    const current = (await getOrder(orderId)) ?? tx;
    return { outcome: current.status === "confirmada" ? "ya_confirmada" : "cerrada", order: current };
  }
  const order = claimed[0];

  const ops = [];
  if (tx.listingId) {
    // La oferta también se reclama de forma atómica.
    const [l] = await db
      .update(listing)
      .set({ status: "vendida", closedAt: now, buyerId: tx.userId })
      .where(and(eq(listing.id, tx.listingId), eq(listing.status, "activa")))
      .returning();
    if (!l) {
      const [reverted] = await db
        .update(ledgerTx)
        .set({ status: unfulfilled, confirmedAt: null, note: `La oferta ya no estaba disponible cuando se confirmó el pago.${refundNote}` })
        .where(eq(ledgerTx.id, orderId))
        .returning();
      payLog("orden_sin_cupo", { orderId, listingId: tx.listingId, status: unfulfilled });
      return { outcome: "sin_cupo", order: reverted };
    }
    const seller = await getKwPosition(l.sellerId, now);
    const avgCost = seller.kw > 0 ? Math.round(seller.investedCop / seller.kw) : l.pricePerKwCop;
    ops.push(
      db.insert(positionEntry).values({ id: newId("pe-"), userId: l.sellerId, plantId: PLANT.id, kwDelta: -kw, pricePerKwCop: avgCost, ts: now, txId: tx.id }),
      db.insert(ledgerTx).values({
        id: newId("tx-"),
        userId: l.sellerId,
        kind: "venta_p2p",
        status: "confirmada",
        kw,
        amountCop: tx.amountCop,
        asset: "COP",
        listingId: l.id,
        txHash: order.txHash,
        createdAt: now,
        confirmedAt: now,
      }),
    );
  }
  ops.push(
    db.insert(positionEntry).values({
      id: newId("pe-"),
      userId: tx.userId,
      plantId: PLANT.id,
      kwDelta: kw,
      pricePerKwCop: Math.round(tx.amountCop / kw),
      ts: now,
      txId: tx.id,
    }),
  );
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);
  payLog("kw_asignados", { orderId, userId: tx.userId, kw, amountCop: tx.amountCop, proveedor: tx.method, providerId: order.providerId });
  return { outcome: "confirmada", order };
}
