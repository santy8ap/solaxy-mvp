import { requireAdminApi } from "@/lib/admin/access";
import { listWithdrawals } from "@/lib/admin/service";
import { handleError } from "@/lib/api";

export async function GET() {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    return Response.json({ withdrawals: await listWithdrawals() });
  } catch (e) {
    return handleError(e);
  }
}
