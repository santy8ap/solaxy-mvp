import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyProfile, ledgerTx, planSubscription, user, type PaymentMethod, type TxStatus } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { formatCop } from "@/lib/format";
import { getOrder, type OrderRow } from "@/lib/orders";
import { submitCryptoPayment, verifyCryptoOrder, type CryptoDeps } from "@/lib/payments/crypto-service";
import { MP_SANDBOX_NETWORK, syncMercadoPagoOrder } from "@/lib/payments/mercadopago-service";
import { toTxDTO, type TxDTO } from "@/lib/portfolio";
import { readSettings } from "@/lib/settings";
import { dayStartMs, localDayIndex } from "@/lib/time";
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
  companyName: string | null;
  planName: string | null;
  method: PaymentMethod | null;
  providerId: string | null;
  providerStatus: string | null;
  expectedAmount: string | null;
  expiresAt: number | null;
  chainId: number | null;
}

type Who = { name: string | null; email: string | null; companyName: string | null; planName: string | null };

function toRow(t: OrderRow, w: Who | null): AdminPaymentRow {
  return {
    ...toTxDTO(t),
    userId: t.userId,
    userName: w?.name ?? "—",
    userEmail: w?.email ?? "",
    companyName: w?.companyName || null,
    planName: w?.planName ?? null,
    method: t.method,
    providerId: t.providerId,
    providerStatus: t.providerStatus,
    expectedAmount: t.expectedAmount,
    expiresAt: t.expiresAt,
    chainId: t.chainId,
  };
}

const paymentRows = () =>
  db
    .select({ t: ledgerTx, name: user.name, email: user.email, companyName: companyProfile.companyName, planName: planSubscription.planName })
    .from(ledgerTx)
    .leftJoin(user, eq(user.id, ledgerTx.userId))
    .leftJoin(companyProfile, eq(companyProfile.userId, ledgerTx.userId))
    .leftJoin(planSubscription, eq(planSubscription.id, ledgerTx.subscriptionId));

/** Pagos de mensualidades (confirmados, en proceso o fallidos) por cualquier medio. */
export async function listPayments({ status = "todos", method = "todos", limit = 200 }: { status?: PaymentFilter; method?: PaymentMethod | "todos"; limit?: number } = {}) {
  await readSettings();
  const where = and(
    isNotNull(ledgerTx.method),
    eq(ledgerTx.kind, "plan_mes"),
    method !== "todos" ? eq(ledgerTx.method, method) : undefined,
    status !== "todos" ? inArray(ledgerTx.status, STATUS_BY_FILTER[status]) : undefined,
  );
  const rows = await paymentRows().where(where).orderBy(desc(ledgerTx.createdAt)).limit(limit);
  return rows.map((r) => toRow(r.t, r));
}

/** Pagos con dinero real: Mercado Pago (no de pruebas), cripto en la red principal y pagos registrados por el admin. */
export const realPaymentWhere = or(
  and(eq(ledgerTx.method, "mercadopago"), or(isNull(ledgerTx.network), ne(ledgerTx.network, MP_SANDBOX_NETWORK))),
  and(eq(ledgerTx.method, "crypto"), or(isNull(ledgerTx.chainId), ne(ledgerTx.chainId, 97))),
  eq(ledgerTx.method, "manual"),
);

/** Números para el encabezado de la sección Pagos (solo dinero real: los pagos de prueba no cuentan como recaudo). */
export async function paymentSummary(now = Date.now()) {
  await readSettings();
  const real = realPaymentWhere;
  const today = dayStartMs(localDayIndex(now));
  const [totals] = await db
    .select({
      totalCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
      todayCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' and ${ledgerTx.confirmedAt} >= ${today} then ${ledgerTx.amountCop} end), 0)`,
      inProgress: sql<number>`sum(case when ${ledgerTx.status} = 'verificando' or (${ledgerTx.status} = 'pendiente' and ${ledgerTx.providerId} is not null) then 1 else 0 end)`,
      toRefund: sql<number>`sum(case when ${ledgerTx.status} = 'por_reembolsar' then 1 else 0 end)`,
    })
    .from(ledgerTx)
    .where(and(real, eq(ledgerTx.kind, "plan_mes")));
  return { totalCop: totals?.totalCop ?? 0, todayCop: totals?.todayCop ?? 0, inProgress: totals?.inProgress ?? 0, toRefund: totals?.toRefund ?? 0 };
}

async function requirePayment(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || !order.method || order.kind !== "plan_mes") throw new MarketError("Pago no encontrado", 404);
  return order;
}

async function rowOf(orderId: string) {
  await requirePayment(orderId);
  const [r] = await paymentRows().where(eq(ledgerTx.id, orderId));
  return toRow(r.t, r);
}

/** Vuelve a consultar el pago en Mercado Pago o en la cadena (por ejemplo, si el webhook nunca llegó). */
export async function reverifyPayment(actor: Actor, orderId: string, deps: CryptoDeps & { fetch?: typeof fetch } = {}) {
  const order = await requirePayment(orderId);
  if (order.method === "mercadopago") {
    // Busca los pagos de la orden por su referencia: sirve aunque el usuario no haya vuelto del checkout.
    if (order.status !== "pendiente" && order.status !== "fallida") throw new MarketError("Este pago ya está cerrado.", 409);
    await syncMercadoPagoOrder({ orderId: order.id }, { fetch: deps.fetch });
  } else if (order.method === "crypto") {
    if (!order.providerId) throw new MarketError("Este pago no tiene hash todavía. Si el usuario ya pagó, registra el hash de la transacción.", 409);
    await verifyCryptoOrder(order.id, deps);
  } else {
    throw new MarketError("Este pago no se verifica con un proveedor.", 409);
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
