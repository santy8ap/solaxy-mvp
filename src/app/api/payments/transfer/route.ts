import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { PLAN_TARGET_ERROR, onePlanTarget, planTarget } from "@/lib/payments/plan-target";
import { transferInstructions } from "@/lib/payments/transfer";
import { TOO_MANY_SYNCS, syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object(planTarget).refine(onePlanTarget, PLAN_TARGET_ERROR);

/** Los datos para pagar el mes por transferencia: cuenta, valor exacto y referencia. No crea ninguna orden. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await syncLimiter.hit(user.id))) return jsonError(TOO_MANY_SYNCS, 429);
    return Response.json(await transferInstructions({ userId: user.id, ...b }));
  } catch (e) {
    return handleError(e);
  }
}
