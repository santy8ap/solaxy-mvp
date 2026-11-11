import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { authorizedCron } from "@/lib/jobs/auth";
import { reconcileMercadoPago } from "@/lib/jobs/reconcile-mercadopago";
import { reconcilePayments } from "@/lib/jobs/reconcile-payments";

export const maxDuration = 60;

export async function GET(request: Request) {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  if (!authorizedCron(request.headers.get("authorization")))
    return Response.json({ error: "No autorizado" }, { status: 401, headers });
  try {
    // Pasada completa: cripto en verificación, Mercado Pago pendiente y devoluciones de los últimos 180 días.
    const crypto = await reconcilePayments();
    const mercadopago = await reconcileMercadoPago({ mode: "completo" });
    return Response.json({ crypto, mercadopago }, { headers });
  } catch (error) {
    return handleError(error);
  }
}
