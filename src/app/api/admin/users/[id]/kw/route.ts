import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { adjustUserKw } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";

const Body = z.object({
  mode: z.enum(["set", "delta"]),
  kw: z.number().min(-50_000).max(50_000),
  sinceDays: z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90)]),
  reason: z.string().max(200).default(""),
});

export async function POST(req: Request, ctx: RouteContext<"/api/admin/users/[id]/kw">) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    return Response.json(await adjustUserKw({ id: admin.user.id, name: admin.user.name }, { userId: id, ...b }));
  } catch (e) {
    return handleError(e);
  }
}
