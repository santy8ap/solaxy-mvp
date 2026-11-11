import { requireAdminApi } from "@/lib/admin/access";
import { adminOverview } from "@/lib/admin/service";
import { handleError } from "@/lib/api";
import { after } from "next/server";
import { maybeReconcile } from "@/lib/jobs/tick";

export async function GET() {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    after(() => maybeReconcile());
    return Response.json(await adminOverview());
  } catch (e) {
    return handleError(e);
  }
}
