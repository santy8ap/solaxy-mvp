import "server-only";
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledgerTx, planSubscription } from "@/lib/db/schema";
import type { HistoryFilters } from "@/lib/history-filters";
import { toTxDTO } from "@/lib/portfolio";

export const HISTORY_PAGE_SIZE = 20;
type Cursor = { createdAt: number; id: string };

const conditions = (userId: string, filters: HistoryFilters, cursor?: Cursor) =>
  and(
    eq(ledgerTx.userId, userId),
    filters.from != null ? gte(ledgerTx.createdAt, filters.from) : undefined,
    filters.until != null ? lt(ledgerTx.createdAt, filters.until) : undefined,
    filters.kind ? eq(ledgerTx.kind, filters.kind) : undefined,
    filters.status
      ? eq(
          ledgerTx.status,
          filters.status as typeof ledgerTx.$inferSelect.status,
        )
      : undefined,
    cursor
      ? or(
          lt(ledgerTx.createdAt, cursor.createdAt),
          and(
            eq(ledgerTx.createdAt, cursor.createdAt),
            lt(ledgerTx.id, cursor.id),
          ),
        )
      : undefined,
  );

async function rows(
  userId: string,
  filters: HistoryFilters,
  limit: number,
  cursor?: Cursor,
  offset = 0,
) {
  const result = await db
    .select({ tx: ledgerTx, planName: planSubscription.planName })
    .from(ledgerTx)
    .leftJoin(
      planSubscription,
      eq(planSubscription.id, ledgerTx.subscriptionId),
    )
    .where(conditions(userId, filters, cursor))
    .orderBy(desc(ledgerTx.createdAt), desc(ledgerTx.id))
    .limit(limit)
    .offset(offset);
  return result.map(({ tx, planName }) => ({ ...toTxDTO(tx), planName }));
}

export async function listTransactions(
  userId: string,
  filters: HistoryFilters,
) {
  const [count] = await db
    .select({ total: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(conditions(userId, filters));
  return {
    transactions: await rows(
      userId,
      filters,
      HISTORY_PAGE_SIZE,
      undefined,
      (filters.page - 1) * HISTORY_PAGE_SIZE,
    ),
    total: Number(count.total),
    page: filters.page,
    pageSize: HISTORY_PAGE_SIZE,
  };
}

/** Exportación por lotes: no corta el historial a los 60 movimientos del resumen. */
export const transactionBatch = (
  userId: string,
  filters: HistoryFilters,
  cursor?: Cursor,
) => rows(userId, filters, 500, cursor);

export type TransactionHistory = Awaited<ReturnType<typeof listTransactions>>;
