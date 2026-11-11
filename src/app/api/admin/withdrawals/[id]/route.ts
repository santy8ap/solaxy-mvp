import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { decideWithdrawal } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";
import { safeText } from "@/lib/security/text";

const Body = z.object({ decision: z.enum(["aprobar", "rechazar"]), reason: safeText(200, { label: "El motivo" }).default(""), reference: safeText(120, { label: "La referencia" }).default("") });

export async function POST(req: Request, ctx: RouteContext<"/api/admin/withdrawals/[id]">) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    return Response.json(await decideWithdrawal({ id: admin.user.id, name: admin.user.name }, id, b.decision, b.reason, b.reference));
  } catch (e) {
    return handleError(e);
  }
}
