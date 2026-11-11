import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { alertWithdrawalRequested } from "@/lib/alerts";
import { db } from "@/lib/db";
import { ledgerTx, walletLink } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { formatCop } from "@/lib/format";
import { orderCode } from "@/lib/ids";
import { getBalance, toTxDTO } from "@/lib/portfolio";
import { requireCompleteProfile } from "@/lib/profile";
import { getRates } from "@/lib/rates";
import { buildWithdrawalMessage, verifyWalletSignature } from "@/lib/signing";
import {
  MIN_WITHDRAWAL_COP,
  parseBankDestination,
} from "@/lib/withdrawal-schema";
import {
  noPaymentReviewSql,
  requireNoPaymentReview,
} from "@/lib/payments/reversals";

/**
 * Retiros del saldo. Todos quedan esperando al administrador, que hace el envío y registra su referencia.
 * Destinos: una cuenta bancaria a nombre de la empresa, o una wallet (USDT) cuya propiedad se prueba con una firma.
 */

/** Tiempo para firmar un retiro a wallet antes de que expire. */
const SIGN_TTL_MS = 15 * 60_000;

const withdrawalCode = () => `RET-${orderCode().slice(4)}`;

/**
 * Lo ya retirado más lo que está en revisión. Va dentro de la sentencia que aparta el saldo:
 * así dos solicitudes simultáneas no pueden retirar el mismo dinero.
 */
const committedSql = (userId: string) => sql`(
  SELECT coalesce(sum(amount_cop), 0) FROM ledger_tx
  WHERE user_id = ${userId} AND kind = 'retiro' AND status IN ('confirmada', 'por_aprobar')
)`;

async function checkAmount(userId: string, raw: number, now: number) {
  await requireNoPaymentReview(userId);
  const amountCop = Math.floor(raw);
  if (!Number.isFinite(amountCop) || amountCop < MIN_WITHDRAWAL_COP)
    throw new MarketError(
      `El retiro mínimo es de ${formatCop(MIN_WITHDRAWAL_COP)}.`,
    );
  const bal = await getBalance(userId, now);
  if (amountCop > bal.balance)
    throw new MarketError("No tienes saldo suficiente para ese retiro.");
  // La venta acumulada solo crece con el tiempo: el tope calculado ahora sigue siendo válido al apartar el saldo.
  return { amountCop, soldCop: Math.floor(bal.soldCop) };
}

/** Retiro a una cuenta bancaria. Queda de una vez en revisión: quien lo aprueba verifica que la cuenta sea de la empresa. */
export async function createBankWithdrawal(input: {
  userId: string;
  amountCop: number;
  destination: Record<string, unknown>;
}) {
  const now = Date.now();
  await requireCompleteProfile(input.userId);
  const dest = parseBankDestination(input.destination);
  if (!dest.ok)
    throw new MarketError(
      Object.values(dest.errors)[0] ?? "Revisa la cuenta bancaria",
      400,
      { fields: dest.errors },
    );
  const { amountCop, soldCop } = await checkAmount(
    input.userId,
    input.amountCop,
    now,
  );
  const id = withdrawalCode();
  const res = await db.run(sql`
    INSERT INTO ledger_tx (id, user_id, kind, status, amount_cop, asset, bank_name, bank_account_type, bank_account_number, created_at)
    SELECT ${id}, ${input.userId}, 'retiro', 'por_aprobar', ${amountCop}, 'COP', ${dest.value.bank}, ${dest.value.accountType}, ${dest.value.accountNumber}, ${now}
    WHERE ${committedSql(input.userId)} + ${amountCop} <= ${soldCop}
      AND ${noPaymentReviewSql(input.userId)}
  `);
  if (!res.rowsAffected)
    throw new MarketError("No tienes saldo suficiente para ese retiro.", 409);
  alertWithdrawalRequested({ id, userId: input.userId, amountCop, bankName: dest.value.bank });
  return getWithdrawal(input.userId, id);
}

/** Retiro a una wallet: se crea pendiente y devuelve el mensaje que la wallet debe firmar. */
export async function createWalletWithdrawal(input: {
  userId: string;
  amountCop: number;
  walletAddress: string;
  walletName: string;
  chainId: number | null;
}) {
  const now = Date.now();
  await requireCompleteProfile(input.userId);
  const { amountCop } = await checkAmount(input.userId, input.amountCop, now);
  const rates = await getRates();
  const id = withdrawalCode();
  const message = buildWithdrawalMessage({
    code: id,
    amountCop,
    walletAddress: input.walletAddress,
    createdAt: now,
  });
  const assetAmount = amountCop / rates.prices.USDT.cop;
  await db.insert(ledgerTx).values({
    id,
    userId: input.userId,
    kind: "retiro",
    status: "pendiente",
    amountCop,
    asset: "USDT",
    assetAmount,
    network:
      input.chainId === 1 ? "Ethereum (ERC-20)" : "BNB Smart Chain (BEP-20)",
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    walletName: input.walletName.slice(0, 40),
    message,
    createdAt: now,
  });
  return { withdrawalId: id, message, amountCop, assetAmount };
}

/** Con la firma de la wallet de destino, el retiro pasa a revisión y aparta el saldo. */
export async function confirmWalletWithdrawal(
  userId: string,
  withdrawalId: string,
  signature: string,
) {
  await requireNoPaymentReview(userId);
  const now = Date.now();
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.id, withdrawalId),
        eq(ledgerTx.userId, userId),
        eq(ledgerTx.kind, "retiro"),
      ),
    );
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  if (tx.status === "confirmada" || tx.status === "por_aprobar")
    return toTxDTO(tx);
  if (tx.status !== "pendiente" || now - tx.createdAt > SIGN_TTL_MS)
    throw new MarketError("Este retiro expiró. Crea uno nuevo.", 410);
  const valid = await verifyWalletSignature({
    address: tx.walletAddress ?? "",
    message: tx.message ?? "",
    signature,
  });
  if (!valid)
    throw new MarketError("La firma no corresponde a la wallet de destino.");
  const bal = await getBalance(userId, now);
  const res = await db.run(sql`
    UPDATE ledger_tx SET status = 'por_aprobar', signature = ${signature}
    WHERE id = ${withdrawalId} AND status = 'pendiente'
      AND ${committedSql(userId)} + ${tx.amountCop} <= ${Math.floor(bal.soldCop)}
      AND ${noPaymentReviewSql(userId)}
  `);
  if (!res.rowsAffected) {
    const current = await getWithdrawal(userId, withdrawalId);
    if (current.status === "por_aprobar") return current;
    throw new MarketError("No tienes saldo suficiente para ese retiro.", 409);
  }
  alertWithdrawalRequested({ id: withdrawalId, userId, amountCop: tx.amountCop, bankName: null });
  return getWithdrawal(userId, withdrawalId);
}

export async function getWithdrawal(userId: string, withdrawalId: string) {
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.id, withdrawalId),
        eq(ledgerTx.userId, userId),
        eq(ledgerTx.kind, "retiro"),
      ),
    );
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  return toTxDTO(tx);
}

/** Recuerda la última wallet que conectó el usuario. */
export async function linkWallet(
  userId: string,
  w: { address: string; walletName: string; chainId: number | null },
) {
  const values = {
    address: w.address,
    walletName: w.walletName,
    chainId: w.chainId,
    connectedAt: Date.now(),
  };
  await db
    .insert(walletLink)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: walletLink.userId, set: values });
}
