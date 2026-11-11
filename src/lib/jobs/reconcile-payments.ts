import "server-only";
import { and, asc, eq, gt, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { jobState, ledgerTx } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { rpcChainReader } from "@/lib/payments/chain";
import { cryptoConfig } from "@/lib/payments/config";
import { verifyCryptoOrder } from "@/lib/payments/crypto-service";
import { payLog } from "@/lib/payments/log";

const JOB_ID = "reconcile-crypto";
const LEASE_MS = 90_000;
const BUDGET_MS = 30_000;
const BATCH = 20;

/** Lote acotado, arrendamiento en la base y cursor durable: no depende de que alguien abra el panel. */
export async function reconcilePayments({
  verify = verifyCryptoOrder,
  clock = Date.now,
}: {
  verify?: typeof verifyCryptoOrder;
  clock?: () => number;
} = {}) {
  await ensureReady();
  const cfg = cryptoConfig();
  if (!cfg.enabled) return { skipped: "disabled", processed: 0, failed: 0 };
  const now = clock();
  const lockToken = newId("job-");
  const [lease] = await db
    .insert(jobState)
    .values({
      id: JOB_ID,
      lockToken,
      lockedUntil: now + LEASE_MS,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: jobState.id,
      set: { lockToken, lockedUntil: now + LEASE_MS, updatedAt: now },
      setWhere: lte(jobState.lockedUntil, now),
    })
    .returning();
  if (!lease) return { skipped: "locked", processed: 0, failed: 0 };
  let cursor = lease.cursor;
  let processed = 0;
  let failed = 0;
  const pending = (after: string | null) =>
    db
      .select({ id: ledgerTx.id })
      .from(ledgerTx)
      .where(
        and(
          eq(ledgerTx.method, "crypto"),
          eq(ledgerTx.status, "verificando"),
          isNotNull(ledgerTx.providerId),
          after ? gt(ledgerTx.id, after) : undefined,
        ),
      )
      .orderBy(asc(ledgerTx.id))
      .limit(BATCH);
  try {
    let rows = await pending(cursor);
    if (!rows.length && cursor) rows = await pending(null);
    const reader = rpcChainReader(cfg.rpcUrl, { timeout: 4500, retryCount: 0 });
    for (const row of rows) {
      if (clock() - now >= BUDGET_MS) break;
      try {
        await verify(row.id, { reader });
      } catch (error) {
        failed++;
        payLog("reconciliacion_pendiente", {
          orderId: row.id,
          error: String(error).slice(0, 200),
        });
      }
      processed++;
      cursor = row.id;
      // Guarda también el avance parcial si la función se interrumpe después.
      await db
        .update(jobState)
        .set({ cursor, updatedAt: clock() })
        .where(and(eq(jobState.id, JOB_ID), eq(jobState.lockToken, lockToken)));
    }
    const result = { skipped: null, processed, failed };
    payLog("reconciliacion_finalizada", result);
    return result;
  } finally {
    await db
      .update(jobState)
      .set({ lockedUntil: 0, cursor, updatedAt: clock() })
      .where(and(eq(jobState.id, JOB_ID), eq(jobState.lockToken, lockToken)));
  }
}
