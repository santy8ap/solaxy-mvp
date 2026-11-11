import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { authorizedCron } from "@/lib/jobs/auth";
import { reconcileMercadoPago } from "@/lib/jobs/reconcile-mercadopago";
import { reconcilePayments } from "@/lib/jobs/reconcile-payments";
import { claimInterval } from "@/lib/jobs/tick";

export const maxDuration = 60;

export async function GET(request: Request) {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  if (!authorizedCron(request.headers.get("authorization")))
    return Response.json({ error: "No autorizado" }, { status: 401, headers });
  try {
    // Aunque alguien tenga la clave, la pasada completa corre como máximo una vez cada 10 minutos.
    if (!(await claimInterval({ id: "cron-payments", intervalMs: 10 * 60_000 })))
      return Response.json({ skipped: "reciente" }, { status: 429, headers });
    // Pasada completa: cripto en verificación, Mercado Pago pendiente y devoluciones de los últimos 180 días.
    const crypto = await reconcilePayments();
    const mercadopago = await reconcileMercadoPago({ mode: "completo" });
    return Response.json({ crypto, mercadopago }, { headers });
  } catch (error) {
    return handleError(error);
  }
}
