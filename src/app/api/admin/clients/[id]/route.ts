import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { clientDetail } from "@/lib/admin/client-detail";
import { handleError } from "@/lib/api";

/** La ficha completa de un comercializador. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/clients/[id]">) {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    return Response.json(await clientDetail(id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
