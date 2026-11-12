import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { handleError, readJson } from "@/lib/api";
import { answerRequest, deleteAccount } from "@/lib/privacy";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("eliminar"), note: z.string().max(600).optional() }),
  z.object({ action: z.literal("responder"), note: z.string().max(600) }),
]);

/** El admin atiende una solicitud sobre datos personales: elimina la cuenta o responde sin eliminarla. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/data-requests/[id]">) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    const actor = { id: admin.user.id, name: admin.user.name };
    return Response.json(b.action === "eliminar" ? await deleteAccount(actor, id, b.note) : await answerRequest(actor, id, b.note));
  } catch (e) {
    return handleError(e);
  }
}
