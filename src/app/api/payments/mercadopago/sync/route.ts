import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { getOrder } from "@/lib/orders";
import { syncMercadoPagoOrder } from "@/lib/payments/mercadopago-service";
import { toTxDTO } from "@/lib/portfolio";
import { syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object({
  ref: z.string().regex(/^SLX-[0-9A-F]{6,12}$/, "Orden inválida"),
  paymentId: z.string().regex(/^\d{1,20}$/).optional(),
});

/** Al volver del checkout: consulta los pagos de la orden en Mercado Pago y la actualiza. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    // Solo el dueño de la orden puede consultarla.
    const order = await getOrder(b.ref);
    if (!order || order.userId !== user.id || order.method !== "mercadopago") return jsonError("No encontramos ese pago en tu cuenta.", 404);
    if (!syncLimiter.hit(user.id)) return jsonError("Demasiadas consultas seguidas. Espera un momento.", 429);
    const r = await syncMercadoPagoOrder({ orderId: b.ref, paymentId: b.paymentId });
    if (!r) return jsonError("No encontramos ese pago en tu cuenta.", 404);
    return Response.json({ order: toTxDTO(r.order), outcome: r.outcome });
  } catch (e) {
    return handleError(e);
  }
}
