import "server-only";
import { and, asc, eq, gt, gte, inArray, isNotNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx } from "@/lib/db/schema";
import { mercadoPagoConfig } from "@/lib/payments/config";
import { payLog } from "@/lib/payments/log";
import { syncMercadoPagoOrder } from "@/lib/payments/mercadopago-service";
import { DAY_MS } from "@/lib/time";
import { readCursor, saveCursor } from "./claim";
import { MP_ABANDONED_MS } from "./housekeeping";

/** Un pago que Mercado Pago tiene en proceso (ya existe allá) se sigue consultando hasta 30 días. */
const IN_PROCESS_WINDOW_MS = 30 * DAY_MS;
/** Un contracargo puede llegar meses después: los pagos confirmados se revisan durante 180 días. */
const CONFIRMED_WINDOW_MS = 180 * DAY_MS;
const BUDGET_MS = 20_000;
const BATCH = { frecuente: 10, completo: 50 } as const;
const CURSOR = { pending: "mp-pendientes", confirmed: "mp-confirmados" } as const;

/**
 * Una tanda de `limit` órdenes que rota: sigue después de la última que se revisó y, si se acaban, vuelve a
 * empezar (sin repetir ninguna en la misma pasada). Así, con más órdenes de las que caben en una pasada,
 * todas se revisan por turnos en lugar de consultar siempre las mismas.
 */
async function rotatingBatch(where: SQL | undefined, cursor: string | null, limit: number) {
  const page = (range: SQL | undefined, n: number) =>
    db
      .select({ id: ledgerTx.id })
      .from(ledgerTx)
      .where(and(where, range))
      .orderBy(asc(ledgerTx.id))
      .limit(n);
  const next = await page(cursor ? gt(ledgerTx.id, cursor) : undefined, limit);
  if (!cursor || next.length >= limit) return next;
  return [...next, ...(await page(lte(ledgerTx.id, cursor), limit - next.length))];
}

/**
 * Consulta en Mercado Pago las órdenes cuyo aviso (webhook) pudo perderse: si el pago se aprobó,
 * se activa el mes; si se devolvió, se registra la devolución. Lo hace syncMercadoPagoOrder, igual
 * que cuando la empresa vuelve del checkout o llega el aviso.
 * - "frecuente": pagos abiertos (corre con las visitas, cada pocos minutos). Sin pago en Mercado Pago, durante
 *   2 días (después la orden se cancela por abandonada); con un pago en proceso, hasta 30 días.
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
  const mine = and(eq(ledgerTx.method, "mercadopago"), eq(ledgerTx.kind, "plan_mes"));
  const pendingRows = await rotatingBatch(
    and(
      mine,
      inArray(ledgerTx.status, ["pendiente", "verificando"]),
      or(gte(ledgerTx.createdAt, now - MP_ABANDONED_MS), and(isNotNull(ledgerTx.providerId), gte(ledgerTx.createdAt, now - IN_PROCESS_WINDOW_MS))),
    ),
    await readCursor(CURSOR.pending),
    limit,
  );
  const confirmedRows =
    mode === "completo"
      ? await rotatingBatch(and(mine, eq(ledgerTx.status, "confirmada"), gte(ledgerTx.confirmedAt, now - CONFIRMED_WINDOW_MS)), await readCursor(CURSOR.confirmed), limit)
      : [];

  let failed = 0;
  const counts = { pending: 0, confirmed: 0 };
  for (const [kind, rows] of [
    ["pending", pendingRows],
    ["confirmed", confirmedRows],
  ] as const) {
    let last: string | null = null;
    for (const row of rows) {
      if (clock() - now >= BUDGET_MS) break;
      try {
        await sync({ orderId: row.id });
      } catch (error) {
        failed++;
        payLog("conciliacion_mp_fallida", { orderId: row.id, error: String(error).slice(0, 200) });
      }
      counts[kind]++;
      last = row.id;
    }
    // La siguiente pasada sigue desde aquí, aunque esta se haya quedado sin tiempo.
    if (last) await saveCursor(CURSOR[kind], last, now);
  }
  const result = { skipped: null, ...counts, failed };
  payLog("conciliacion_mp_finalizada", { modo: mode, ...result });
  return result;
}
