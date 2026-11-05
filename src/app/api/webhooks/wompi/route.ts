import { handleError } from "@/lib/api";
import { handleWompiEvent } from "@/lib/payments/wompi-service";

/**
 * URL de eventos de Wompi: configúrala en el panel de Wompi como https://<dominio>/api/webhooks/wompi.
 * Responde 200 solo si el evento quedó procesado; con cualquier otro código Wompi lo reintenta.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const r = await handleWompiEvent(body, req.headers.get("x-event-checksum"));
    return Response.json({ message: r.message }, { status: r.status });
  } catch (e) {
    return handleError(e);
  }
}
