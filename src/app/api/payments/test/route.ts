import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { PLAN_TARGET_ERROR, onePlanTarget, planTarget } from "@/lib/payments/plan-target";
import { payWithTestPayment } from "@/lib/payments/test-payment";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object(planTarget).refine(onePlanTarget, PLAN_TARGET_ERROR);

/** Pago de prueba: activa el mes al instante sin mover dinero. Solo en modo de pruebas. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await orderLimiter.hit(user.id))) return jsonError(TOO_MANY_ORDERS, 429);
    return Response.json(await payWithTestPayment({ userId: user.id, ...b }), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
