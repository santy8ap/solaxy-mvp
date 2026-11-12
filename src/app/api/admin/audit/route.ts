import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { listAudit } from "@/lib/admin/service";
import { handleError } from "@/lib/api";
import { ADMIN_ACTIONS } from "@/lib/db/schema";

/** La bitácora del admin (?accion=&q=&limite=). */
export async function GET(req: Request) {
  try {
    await connection();
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    const params = new URL(req.url).searchParams;
    const accion = params.get("accion") ?? "";
    const limit = Number(params.get("limite")) || 100;
    return Response.json({
      entries: await listAudit(limit, {
        action: (ADMIN_ACTIONS as readonly string[]).includes(accion) ? accion : undefined,
        query: params.get("q") ?? "",
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
