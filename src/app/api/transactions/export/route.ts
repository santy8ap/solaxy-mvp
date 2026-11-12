import { handleError } from "@/lib/api";
import { csvLine } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { paymentMethodLabel, txStatusLabel } from "@/lib/labels";
import { historyFilters, isoColombiaDate } from "@/lib/history-filters";
import { getSessionUser, unauthorized } from "@/lib/session";
import { transactionBatch } from "@/lib/transactions";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const filters = historyFilters(new URL(req.url).searchParams);
    const encoder = new TextEncoder();
    let cursor: { createdAt: number; id: string } | undefined;
    let started = false;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (cancelled) return;
        try {
          const batch = await transactionBatch(user.id, filters, cursor);
          let chunk = started
            ? ""
            : "\ufeff" +
              csvLine([
                "Fecha (Colombia)",
                "Referencia",
                "Tipo",
                "Estado",
                "Monto COP",
                "Medio",
                "Paquete",
                "Mes",
                "Energía kWh",
              ]);
          started = true;
          for (const tx of batch)
            chunk += csvLine([
              formatDateTime(tx.createdAt),
              tx.id,
              tx.kind === "retiro" ? "Retiro" : "Pago de paquete",
              txStatusLabel(tx.status),
              tx.kind === "retiro" ? -tx.amountCop : tx.amountCop,
              paymentMethodLabel(tx.method),
              tx.planName,
              tx.periodIndex,
              tx.kwh,
            ]);
          if (cancelled) return;
          controller.enqueue(encoder.encode(chunk));
          if (batch.length < 500) controller.close();
          else {
            const last = batch[batch.length - 1];
            cursor = { createdAt: last.createdAt, id: last.id };
          }
        } catch (error) {
          if (!cancelled) controller.error(error);
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="x-green-energy-movimientos-${isoColombiaDate(Date.now())}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
