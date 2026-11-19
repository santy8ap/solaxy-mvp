import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { closeClientSessions } from "@/lib/admin/client-detail";
import { handleError } from "@/lib/api";

/** Cierra todas las sesiones abiertas de un cliente: tendrá que volver a ingresar. */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/clients/[id]/sessions">) {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    return Response.json(await closeClientSessions({ id: admin.user.id, name: admin.user.name }, id));
  } catch (e) {
    return handleError(e);
  }
}
