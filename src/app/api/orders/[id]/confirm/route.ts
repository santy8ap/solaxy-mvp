import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { confirmBuyOrder } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

const Body = z.object({
  signature: z.string().max(1000).optional(),
  simulated: z.boolean().optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/orders/[id]/confirm">) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    return Response.json(await confirmBuyOrder(user.id, id, b));
  } catch (e) {
    return handleError(e);
  }
}
