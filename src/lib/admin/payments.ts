import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx, user, type PaymentMethod, type TxStatus } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { formatCop } from "@/lib/format";
import { getOrder, type OrderRow } from "@/lib/orders";
import { submitCryptoPayment, verifyCryptoOrder, type CryptoDeps } from "@/lib/payments/crypto-service";
import { syncWompiTransaction } from "@/lib/payments/wompi-service";
import { toTxDTO, type TxDTO } from "@/lib/portfolio";
import { localDayIndex, dayStartMs } from "@/lib/sim";
import { audit, type Actor } from "./service";

export type PaymentFilter = "todos" | "en_proceso" | "confirmadas" | "fallidas" | "por_reembolsar";

const STATUS_BY_FILTER: Record<Exclude<PaymentFilter, "todos">, TxStatus[]> = {
  en_proceso: ["pendiente", "verificando"],
  confirmadas: ["confirmada"],
  fallidas: ["fallida", "cancelada"],
  por_reembolsar: ["por_reembolsar", "reembolsada"],
};

export interface AdminPaymentRow extends TxDTO {
  userId: string;
  userName: string;
  userEmail: string;
  method: PaymentMethod | null;
  providerId: string | null;
  providerStatus: string | null;
  expectedAmount: string | null;
  expiresAt: number | null;
  listingId: string | null;
  chainId: number | null;
}

function toRow(t: OrderRow, u: { name: string; email: string } | null): AdminPaymentRow {
  return {
    ...toTxDTO(t),
    userId: t.userId,
    userName: u?.name ?? "—",
    userEmail: u?.email ?? "",
    method: t.method,
    providerId: t.providerId,
    providerStatus: t.providerStatus,
    expectedAmount: t.expectedAmount,
    expiresAt: t.expiresAt,
    listingId: t.listingId,
    chainId: t.chainId,
  };
}

/** Órdenes de compra pagadas (o por pagar) con Wompi, cripto o en modo demo. */
export async function listPayments({ status = "todos", method = "todos", limit = 200 }: { status?: PaymentFilter; method?: PaymentMethod | "todos"; limit?: number } = {}) {
  await ensureReady();
  const where = and(
    isNotNull(ledgerTx.method),
    inArray(ledgerTx.kind, ["compra", "compra_p2p"]),
    method !== "todos" ? eq(ledgerTx.method, method) : undefined,
    status !== "todos" ? inArray(ledgerTx.status, STATUS_BY_FILTER[status]) : undefined,
  );
  const rows = await db
    .select({ t: ledgerTx, name: user.name, email: user.email })
    .from(ledgerTx)
    .leftJoin(user, eq(user.id, ledgerTx.userId))
    .where(where)
    .orderBy(desc(ledgerTx.createdAt))
    .limit(limit);
  return rows.map((r) => toRow(r.t, r.name ? { name: r.name, email: r.email ?? "" } : null));
}

/** Números para el encabezado de la sección Pagos (solo pagos reales: Wompi y cripto). */
export async function paymentSummary(now = Date.now()) {
  await ensureReady();
  // Los pagos de prueba (Wompi sandbox o testnet) no cuentan como recaudo.
  const real = or(
    and(eq(ledgerTx.method, "wompi"), or(isNull(ledgerTx.network), ne(ledgerTx.network, "Wompi (sandbox)"))),
    and(eq(ledgerTx.method, "crypto"), or(isNull(ledgerTx.chainId), ne(ledgerTx.chainId, 97))),
  );
  const today = dayStartMs(localDayIndex(now));
  const [totals] = await db
    .select({
      totalCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
      todayCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' and ${ledgerTx.confirmedAt} >= ${today} then ${ledgerTx.amountCop} end), 0)`,
      inProgress: sql<number>`sum(case when ${ledgerTx.status} = 'verificando' or (${ledgerTx.status} = 'pendiente' and ${ledgerTx.providerId} is not null) then 1 else 0 end)`,
      toRefund: sql<number>`sum(case when ${ledgerTx.status} = 'por_reembolsar' then 1 else 0 end)`,
    })
    .from(ledgerTx)
    .where(and(real, gte(ledgerTx.createdAt, 0)));
  return { totalCop: totals?.totalCop ?? 0, todayCop: totals?.todayCop ?? 0, inProgress: totals?.inProgress ?? 0, toRefund: totals?.toRefund ?? 0 };
}

async function requirePayment(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || !order.method || (order.kind !== "compra" && order.kind !== "compra_p2p")) throw new MarketError("Pago no encontrado", 404);
  return order;
}

async function rowOf(orderId: string) {
  const order = await requirePayment(orderId);
  const [u] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, order.userId));
  return toRow(order, u ?? null);
}

/** Vuelve a consultar el pago en Wompi o en la cadena (por ejemplo, si el webhook nunca llegó). */
export async function reverifyPayment(actor: Actor, orderId: string, deps: CryptoDeps & { fetch?: typeof fetch } = {}) {
  const order = await requirePayment(orderId);
  if (order.method === "wompi") {
    if (!order.providerId) throw new MarketError("Este pago todavía no tiene una transacción de Wompi: el usuario no terminó el checkout.", 409);
    if (order.status !== "pendiente") throw new MarketError("Solo se re-verifican los pagos de Wompi que siguen en proceso.", 409);
    await syncWompiTransaction(order.providerId, { fetch: deps.fetch });
  } else if (order.method === "crypto") {
    if (!order.providerId) throw new MarketError("Este pago no tiene hash todavía. Si el usuario ya pagó, registra el hash de la transacción.", 409);
    await verifyCryptoOrder(order.id, deps);
  } else {
    throw new MarketError("Los pagos de demostración no se verifican con un proveedor.", 409);
  }
  const row = await rowOf(orderId);
  await audit(actor, "reverificar_pago", `Re-verificó el pago ${orderId} (${row.status})`, { orderId, status: row.status }, order.userId);
  return row;
}

/** Si el usuario pagó con cripto pero no quedó registrado el hash (cerró la pestaña), el admin lo agrega. */
export async function attachCryptoHash(actor: Actor, orderId: string, txHash: string, deps: CryptoDeps = {}) {
  const order = await requirePayment(orderId);
  if (order.method !== "crypto") throw new MarketError("Solo los pagos cripto tienen hash", 409);
  await submitCryptoPayment({ userId: order.userId, orderId, txHash }, deps);
  const row = await rowOf(orderId);
  await audit(actor, "registrar_hash", `Registró el hash ${txHash.slice(0, 10)}… del pago ${orderId} (${row.status})`, { orderId, txHash, status: row.status }, order.userId);
  return row;
}

/** Deja constancia de que el admin devolvió un pago que no se pudo asignar. */
export async function markRefunded(actor: Actor, orderId: string, reference: string) {
  const order = await requirePayment(orderId);
  const ref = reference.trim().slice(0, 160);
  if (ref.length < 4) throw new MarketError("Escribe la referencia del reembolso");
  const [row] = await db
    .update(ledgerTx)
    .set({ status: "reembolsada", note: `${order.note ? `${order.note} ` : ""}Reembolsado: ${ref}` })
    .where(and(eq(ledgerTx.id, orderId), eq(ledgerTx.status, "por_reembolsar")))
    .returning();
  if (!row) throw new MarketError("Este pago no está por reembolsar", 409);
  await audit(actor, "marcar_reembolso", `Marcó como reembolsado el pago ${orderId} de ${formatCop(order.amountCop)}: ${ref}`, { orderId, ref }, order.userId);
  return rowOf(orderId);
}
