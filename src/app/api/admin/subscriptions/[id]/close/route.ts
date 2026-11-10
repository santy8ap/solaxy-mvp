import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { closeSubscription } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";

const Body = z.object({ reason: z.string().min(1).max(240) });

/** Cierra un plan antes de tiempo: deja de generar energía y libera su cupo. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/subscriptions/[id]/close">) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    return Response.json(await closeSubscription({ id: admin.user.id, name: admin.user.name }, id, b.reason));
  } catch (e) {
    return handleError(e);
  }
}
