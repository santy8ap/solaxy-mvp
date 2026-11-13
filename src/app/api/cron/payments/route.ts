import { connection } from "next/server";
import { alertFailure } from "@/lib/alerts";
import { handleError } from "@/lib/api";
import { authorizedCron } from "@/lib/jobs/auth";
import { claimInterval } from "@/lib/jobs/claim";
import { runHousekeeping } from "@/lib/jobs/housekeeping";
import { reconcileMercadoPago } from "@/lib/jobs/reconcile-mercadopago";
import { reconcilePayments } from "@/lib/jobs/reconcile-payments";

export const maxDuration = 60;

/**
 * La pasada diaria (Vercel Cron, con CRON_SECRET): pagos cripto en verificación, Mercado Pago pendiente,
 * devoluciones de los últimos 180 días y el mantenimiento (órdenes abandonadas y sesiones vencidas).
 */
export async function GET(request: Request) {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  if (!authorizedCron(request.headers.get("authorization")))
    return Response.json({ error: "No autorizado" }, { status: 401, headers });
  try {
    // Aunque alguien tenga la clave, la pasada completa corre como máximo una vez cada 10 minutos.
    if (!(await claimInterval({ id: "cron-payments", intervalMs: 10 * 60_000 })))
      return Response.json({ skipped: "reciente" }, { status: 429, headers });
    const crypto = await reconcilePayments();
    const mercadopago = await reconcileMercadoPago({ mode: "completo" });
    if (crypto.failed || mercadopago.failed)
      alertFailure(
        "cron-conciliacion",
        "la conciliación diaria de pagos",
        `No se pudieron revisar ${crypto.failed} pagos con cripto y ${mercadopago.failed} de Mercado Pago. Se reintentan solos en la próxima pasada.`,
      );
    // El mantenimiento va aparte: si falla, la conciliación ya quedó hecha.
    const housekeeping = await runHousekeeping().catch((error) => {
      alertFailure("mantenimiento", "el mantenimiento automático", String(error));
      return { error: "falló" as const };
    });
    return Response.json({ crypto, mercadopago, housekeeping }, { headers });
  } catch (error) {
    return handleError(error);
  }
}
