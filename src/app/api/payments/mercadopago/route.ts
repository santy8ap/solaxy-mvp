import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { createMercadoPagoOrder } from "@/lib/payments/mercadopago-service";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z
  .object({ kw: z.number().positive().optional(), listingId: z.string().min(1).max(80).optional() })
  .refine((b) => (b.kw != null) !== (b.listingId != null), "Indica los kW o una oferta del mercado");

/** Crea la orden y devuelve la URL del Checkout Pro de Mercado Pago (tarjeta, PSE o Nequi). */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!orderLimiter.hit(user.id)) return jsonError(TOO_MANY_ORDERS, 429);
    const order = await createMercadoPagoOrder({ userId: user.id, email: user.email, kw: b.kw, listingId: b.listingId });
    return Response.json(order, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
