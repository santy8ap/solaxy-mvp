import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit, type Actor } from "@/lib/admin/service";
import { alertTransferReported } from "@/lib/alerts";
import { emailTransferRejected } from "@/lib/customer-email";
import { db, type DbSession } from "@/lib/db";
import { writeTransaction } from "@/lib/db/transaction";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx, serviceSetting } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { formatCop } from "@/lib/format";
import { orderCode } from "@/lib/ids";
import { closeOrder, fulfillOrder, getOrder } from "@/lib/orders";
import { resolvePlanPayment } from "@/lib/plans/service";
import { toTxDTO, type TxDTO } from "@/lib/portfolio";
import { requireCompleteProfile } from "@/lib/profile";
import { safeText } from "@/lib/security/text";
import { transferReference } from "@/lib/transfer-reference";
import { BANKS } from "@/lib/withdrawal-schema";
import { payLog } from "./log";
import { bankReferenceOwner } from "./bank-reference";
import { assertExpectedPayment, type ExpectedPayment } from "./plan-target";

/**
 * Pago por transferencia bancaria. El comercializador ve la cuenta configurada por el admin, el valor exacto y una
 * referencia (el código del plan y el mes); transfiere y reporta el comprobante. El admin busca la referencia
 * en el banco, confirma con la referencia del banco y entonces se activa el mes.
 */

const SETTING_ID = "transfer";

export const TransferAccountInput = z.object({
  bank: z.enum(BANKS),
  accountType: z.enum(["ahorros", "corriente"]),
  accountNumber: z
    .string()
    .max(40)
    .transform((v) => v.replace(/[\s.-]/g, ""))
    .refine((v) => /^\d{6,20}$/.test(v), "Escribe el número de la cuenta, solo con dígitos (entre 6 y 20)."),
  holder: safeText(120, { min: 3, label: "El titular" }),
  holderId: safeText(30, { min: 5, label: "El NIT o documento del titular" }),
});
export type TransferAccount = z.infer<typeof TransferAccountInput>;

const receiptField = safeText(60, { min: 4, label: "El número del comprobante" });
const bankReferenceField = safeText(120, { min: 4, label: "La referencia del banco" });
const reasonField = safeText(200, { min: 4, label: "El motivo" });

export { transferReference };

/** Estado que ve el comercializador mientras el admin busca la transferencia en el banco. */
export const REPORTED_STATUS = "reportada, en verificación con el banco";

/** La cuenta que ven los comercializadores para transferir, o null si el admin todavía no la configura. */
export async function getTransferAccount(): Promise<TransferAccount | null> {
  await ensureReady();
  const [row] = await db.select().from(serviceSetting).where(eq(serviceSetting.id, SETTING_ID));
  if (!row) return null;
  try {
    const parsed = TransferAccountInput.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveTransferAccount(actor: Actor, input: unknown): Promise<TransferAccount> {
  await ensureReady();
  const data = TransferAccountInput.parse(input);
  const now = Date.now();
  await db
    .insert(serviceSetting)
    .values({ id: SETTING_ID, value: JSON.stringify(data), updatedAt: now })
    .onConflictDoUpdate({ target: serviceSetting.id, set: { value: JSON.stringify(data), updatedAt: now } });
  await audit(actor, "config_transferencia", `Actualizó la cuenta para transferencias: ${data.bank}, cuenta ${data.accountType} terminada en ${data.accountNumber.slice(-4)}`, {
    bank: data.bank,
    accountType: data.accountType,
    last4: data.accountNumber.slice(-4),
  });
  return data;
}

async function requireAccount() {
  const account = await getTransferAccount();
  if (!account) throw new MarketError("El pago por transferencia todavía no está disponible.", 503);
  return account;
}

type TransferTarget = { userId: string; planId?: string; subscriptionId?: string } & ExpectedPayment;

/** Valida el mes que se va a pagar (perfil completo, plan, cupo y precio) igual que los demás medios. */
async function resolveTarget(input: TransferTarget) {
  await requireCompleteProfile(input.userId);
  const p = await resolvePlanPayment(input.userId, { planId: input.planId, subscriptionId: input.subscriptionId }, Date.now());
  assertExpectedPayment(p, input);
  return p;
}

/** La transferencia de ese mes que ya se reportó y sigue sin revisar. */
async function openTransfer(userId: string, subscriptionId: string, periodIndex: number, session: DbSession = db) {
  const [row] = await session
    .select()
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.userId, userId),
        eq(ledgerTx.method, "transferencia"),
        eq(ledgerTx.subscriptionId, subscriptionId),
        eq(ledgerTx.periodIndex, periodIndex),
        inArray(ledgerTx.status, ["pendiente", "verificando"]),
      ),
    );
  return row;
}

export interface TransferInstructions {
  account: TransferAccount;
  /** Lo que el comercializador escribe en la descripción de la transferencia */
  reference: string;
  amountCop: number;
  planName: string;
  periodIndex: number;
  /** La transferencia de este mes que ya se reportó, si la hay */
  order: TxDTO | null;
}

/** Los datos para transferir: cuenta, valor exacto y referencia. No crea ninguna orden. */
export async function transferInstructions(input: TransferTarget): Promise<TransferInstructions> {
  const account = await requireAccount();
  const p = await resolveTarget(input);
  const open = await openTransfer(input.userId, p.subscriptionId, p.periodIndex);
  return {
    account,
    reference: transferReference(p.subscriptionId, p.periodIndex),
    amountCop: p.amountCop,
    planName: p.planName,
    periodIndex: p.periodIndex,
    order: open ? toTxDTO(open) : null,
  };
}

/**
 * El comercializador reporta que ya transfirió el mes. La orden queda "verificando" con el monto que calcula el
 * servidor y el comprobante que escribió; no se activa nada hasta que el admin confirme.
 * Reportar el mismo mes otra vez devuelve la misma orden.
 */
export async function reportTransfer(input: TransferTarget & { receipt: string }) {
  await requireAccount();
  const receipt = receiptField.parse(input.receipt);
  const p = await resolveTarget(input);
  const open = await openTransfer(input.userId, p.subscriptionId, p.periodIndex);
  if (open) return { order: toTxDTO(open), created: false };
  // Se vuelve a buscar dentro de una transacción de escritura: dos avisos a la vez (doble clic, dos pestañas,
  // un reintento de la red) dejan una sola orden.
  const { row, created } = await writeTransaction(async (session) => {
    const again = await openTransfer(input.userId, p.subscriptionId, p.periodIndex, session);
    if (again) return { row: again, created: false };
    const [inserted] = await session
      .insert(ledgerTx)
      .values({
        id: orderCode(),
        userId: input.userId,
        kind: "plan_mes",
        status: "verificando",
        amountCop: p.amountCop,
        asset: "COP",
        createdAt: Date.now(),
        method: "transferencia",
        // El comprobante del banco del comercializador (como en los retiros a cuentas bancarias).
        txHash: receipt,
        providerStatus: REPORTED_STATUS,
        expectedAmount: String(p.amountCop),
        subscriptionId: p.subscriptionId,
        periodIndex: p.periodIndex,
        kwh: p.kwh,
      })
      .returning();
    return { row: inserted, created: true };
  });
  if (!created) return { order: toTxDTO(row), created: false };
  payLog("transferencia_reportada", { orderId: row.id, userId: input.userId, plan: p.subscriptionId, mes: p.periodIndex, amountCop: p.amountCop });
  alertTransferReported(row);
  return { order: toTxDTO(row), created: true };
}

async function requireTransfer(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || order.kind !== "plan_mes" || order.method !== "transferencia") throw new MarketError("Transferencia no encontrada", 404);
  if (order.status !== "verificando" && order.status !== "pendiente") throw new MarketError("Esta transferencia ya fue revisada.", 409);
  return order;
}

const isUniqueViolation = (err: unknown) => /UNIQUE/i.test(`${String((err as Error)?.message ?? err)} ${String((err as { cause?: unknown })?.cause ?? "")}`);

/** El admin vio el dinero en el banco: confirma con la referencia y se activa el mes. */
export async function confirmTransfer(actor: Actor, orderId: string, reference: string) {
  const ref = bankReferenceField.parse(reference);
  const order = await requireTransfer(orderId);
  if (await bankReferenceOwner(ref, orderId)) throw new MarketError("Esa referencia del banco ya se usó para confirmar otro pago.", 409);
  let r: Awaited<ReturnType<typeof fulfillOrder>>;
  try {
    r = await fulfillOrder(orderId, { providerId: ref, providerStatus: "confirmada por el administrador" });
  } catch (err) {
    if (isUniqueViolation(err)) throw new MarketError("Esa referencia del banco ya se usó para confirmar otro pago.", 409);
    throw err;
  }
  if (r.outcome === "ya_confirmada" || r.outcome === "cerrada") throw new MarketError("Esta transferencia ya fue revisada.", 409);
  await audit(
    actor,
    "confirmar_transferencia",
    `Confirmó la transferencia de ${formatCop(order.amountCop)} (${orderId}, ref. ${ref})${r.outcome === "no_activada" ? `. No se activó el mes: ${r.order.note ?? ""}` : ""}`,
    { orderId, reference: ref, outcome: r.outcome },
    order.userId,
  );
  return toTxDTO(r.order);
}

/** La transferencia no llegó (o no coincide): se cierra con el motivo, que el comercializador ve en sus movimientos. */
export async function rejectTransfer(actor: Actor, orderId: string, reason: string) {
  const why = reasonField.parse(reason);
  const order = await requireTransfer(orderId);
  const row = await closeOrder(orderId, "fallida", { note: `Transferencia no confirmada: ${why}`, providerStatus: "no confirmada por el administrador" }, ["pendiente", "verificando"]);
  if (!row) throw new MarketError("Esta transferencia ya fue revisada.", 409);
  emailTransferRejected(row, why);
  await audit(actor, "rechazar_transferencia", `Rechazó la transferencia de ${formatCop(order.amountCop)} (${orderId}): ${why}`, { orderId, reason: why }, order.userId);
  return toTxDTO(row);
}
