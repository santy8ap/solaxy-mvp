import { handleError } from "@/lib/api";
import { handleMercadoPagoNotification } from "@/lib/payments/mercadopago-service";

/**
 * Notificaciones de Mercado Pago. En Mercado Pago → Tus integraciones → Webhooks, la URL es
 * https://<dominio>/api/webhooks/mercadopago con el evento "Pagos". Responde 200 cuando el aviso quedó
 * procesado; con cualquier otro código Mercado Pago lo reintenta.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const r = await handleMercadoPagoNotification({ body, query: new URL(req.url).searchParams, headers: req.headers });
    return Response.json({ message: r.message }, { status: r.status });
  } catch (e) {
    return handleError(e);
  }
}
