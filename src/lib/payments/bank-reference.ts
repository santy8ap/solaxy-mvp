import "server-only";
import { and, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";

/** Cómo se comparan las referencias del banco: sin espacios y sin distinguir mayúsculas. */
export const normalizeBankReference = (reference: string) => reference.replace(/\s+/g, "").toUpperCase();

/**
 * La orden que ya usó esta referencia del banco, si la hay. Un pago registrado a mano y una transferencia
 * confirmada son movimientos del mismo banco: una misma referencia no puede acreditar dos pagos, se escriba
 * como se escriba. (El índice único de la base solo distingue dentro de un mismo medio y con el texto exacto.)
 */
export async function bankReferenceOwner(reference: string, exceptOrderId?: string) {
  const [row] = await db
    .select({ id: ledgerTx.id })
    .from(ledgerTx)
    .where(
      and(
        inArray(ledgerTx.method, ["manual", "transferencia"]),
        sql`upper(replace(${ledgerTx.providerId}, ' ', '')) = ${normalizeBankReference(reference)}`,
        exceptOrderId ? ne(ledgerTx.id, exceptOrderId) : undefined,
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
