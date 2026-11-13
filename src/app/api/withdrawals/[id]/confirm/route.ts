import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { TOO_MANY_SYNCS, syncLimiter } from "@/lib/security/limits";
import { confirmWalletWithdrawal } from "@/lib/withdrawals";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object({ signature: z.string().min(10).max(1000) });

/** La wallet de destino firma el retiro: pasa a revisión y aparta el saldo. */
export async function POST(req: Request, ctx: RouteContext<"/api/withdrawals/[id]/confirm">) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    // Verificar una firma cuesta: el mismo límite de las consultas de pagos.
    if (!(await syncLimiter.hit(user.id))) return jsonError(TOO_MANY_SYNCS, 429);
    return Response.json(await confirmWalletWithdrawal(user.id, id, b.signature));
  } catch (e) {
    return handleError(e);
  }
}
