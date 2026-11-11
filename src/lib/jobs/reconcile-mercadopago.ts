import "server-only";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx } from "@/lib/db/schema";
import { mercadoPagoConfig } from "@/lib/payments/config";
import { payLog } from "@/lib/payments/log";
import { syncMercadoPagoOrder } from "@/lib/payments/mercadopago-service";

const DAY_MS = 86_400_000;
/** Un pago pendiente (PSE puede tardar días) se sigue revisando hasta 3 días después de creado. */
const PENDING_WINDOW_MS = 3 * DAY_MS;
/** Un contracargo puede llegar meses después: los pagos confirmados se revisan durante 180 días. */
const CONFIRMED_WINDOW_MS = 180 * DAY_MS;
const BUDGET_MS = 20_000;
const BATCH = { frecuente: 10, completo: 50 } as const;

/**
 * Consulta en Mercado Pago las órdenes cuyo aviso (webhook) pudo perderse: si el pago se aprobó,
 * se activa el mes; si se devolvió, se registra la devolución. Lo hace syncMercadoPagoOrder, igual
 * que cuando la empresa vuelve del checkout o llega el aviso.
 * - "frecuente": pagos pendientes de los últimos 3 días (corre con las visitas, cada pocos minutos).
 * - "completo": además, pagos confirmados de los últimos 180 días, para detectar devoluciones (cron diario).
 */
export async function reconcileMercadoPago({
  mode,
  sync = syncMercadoPagoOrder,
  clock = Date.now,
}: {
  mode: "frecuente" | "completo";
  sync?: (input: { orderId: string }) => Promise<unknown>;
  clock?: () => number;
}) {
  if (!mercadoPagoConfig().enabled) return { skipped: "disabled" as const, pending: 0, confirmed: 0, failed: 0 };
  await ensureReady();
  const now = clock();
  const limit = BATCH[mode];
  const pendingRows = await db
    .select({ id: ledgerTx.id })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.method, "mercadopago"), eq(ledgerTx.kind, "plan_mes"), inArray(ledgerTx.status, ["pendiente", "verificando"]), gte(ledgerTx.createdAt, now - PENDING_WINDOW_MS)))
    .orderBy(asc(ledgerTx.createdAt))
    .limit(limit);
  const confirmedRows =
    mode === "completo"
      ? await db
          .select({ id: ledgerTx.id })
          .from(ledgerTx)
          .where(and(eq(ledgerTx.method, "mercadopago"), eq(ledgerTx.kind, "plan_mes"), eq(ledgerTx.status, "confirmada"), gte(ledgerTx.confirmedAt, now - CONFIRMED_WINDOW_MS)))
          .orderBy(asc(ledgerTx.confirmedAt))
          .limit(limit)
      : [];

  let failed = 0;
  let pending = 0;
  let confirmed = 0;
  for (const [rows, count] of [
    [pendingRows, () => pending++],
    [confirmedRows, () => confirmed++],
  ] as const) {
    for (const row of rows) {
      if (clock() - now >= BUDGET_MS) break;
      try {
        await sync({ orderId: row.id });
      } catch (error) {
        failed++;
        payLog("conciliacion_mp_fallida", { orderId: row.id, error: String(error).slice(0, 200) });
      }
      count();
    }
  }
  const result = { skipped: null, pending, confirmed, failed };
  payLog("conciliacion_mp_finalizada", { modo: mode, ...result });
  return result;
}
