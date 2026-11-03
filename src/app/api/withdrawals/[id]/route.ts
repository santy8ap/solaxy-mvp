import { handleError } from "@/lib/api";
import { getWithdrawal } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

/** Estado de un retiro (el navegador lo consulta mientras espera la aprobación). */
export async function GET(_req: Request, ctx: RouteContext<"/api/withdrawals/[id]">) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    return Response.json(await getWithdrawal(user.id, id));
  } catch (e) {
    return handleError(e);
  }
}
