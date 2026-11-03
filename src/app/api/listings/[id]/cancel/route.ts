import { handleError } from "@/lib/api";
import { cancelListing } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function POST(_req: Request, ctx: RouteContext<"/api/listings/[id]/cancel">) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    return Response.json(await cancelListing(user.id, id));
  } catch (e) {
    return handleError(e);
  }
}
