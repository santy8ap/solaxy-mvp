import { requireAdminApi } from "@/lib/admin/access";
import { listAudit } from "@/lib/admin/service";
import { handleError } from "@/lib/api";

export async function GET() {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    return Response.json({ entries: await listAudit(100) });
  } catch (e) {
    return handleError(e);
  }
}
