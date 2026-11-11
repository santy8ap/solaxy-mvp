import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { PLAN_TARGET_ERROR, onePlanTarget, planTarget } from "@/lib/payments/plan-target";
import { reportTransfer } from "@/lib/payments/transfer";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z
  .object({ ...planTarget, receipt: z.string().max(200) })
  .refine(onePlanTarget, PLAN_TARGET_ERROR);

/** La empresa avisa que ya transfirió el mes: la orden queda por verificar hasta que el admin la confirme. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await orderLimiter.hit(user.id))) return jsonError(TOO_MANY_ORDERS, 429);
    const { order, created } = await reportTransfer({ userId: user.id, ...b });
    return Response.json({ order }, { status: created ? 201 : 200 });
  } catch (e) {
    return handleError(e);
  }
}
