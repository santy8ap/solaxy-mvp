import { requireAdminApi } from "@/lib/admin/access";
import { adminOverview } from "@/lib/admin/service";
import { handleError } from "@/lib/api";

export async function GET() {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    return Response.json(await adminOverview());
  } catch (e) {
    return handleError(e);
  }
}
