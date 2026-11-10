import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { confirmWalletWithdrawal } from "@/lib/withdrawals";
import { getSessionUser, unauthorized } from "@/lib/session";

const Body = z.object({ signature: z.string().min(10).max(1000) });

export async function POST(req: Request, ctx: RouteContext<"/api/withdrawals/[id]/confirm">) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    return Response.json(await confirmWalletWithdrawal(user.id, id, b.signature));
  } catch (e) {
    return handleError(e);
  }
}
