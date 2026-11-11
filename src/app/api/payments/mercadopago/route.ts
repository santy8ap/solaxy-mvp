import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { createMercadoPagoOrder } from "@/lib/payments/mercadopago-service";
import { PLAN_TARGET_ERROR, onePlanTarget, planTarget } from "@/lib/payments/plan-target";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object(planTarget).refine(onePlanTarget, PLAN_TARGET_ERROR);

/** Crea la orden del mes y devuelve la URL del Checkout Pro de Mercado Pago (PSE o tarjeta). */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await orderLimiter.hit(user.id))) return jsonError(TOO_MANY_ORDERS, 429);
    const order = await createMercadoPagoOrder({ userId: user.id, email: user.email, ...b });
    return Response.json(order, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
