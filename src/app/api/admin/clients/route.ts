import { requireAdminApi } from "@/lib/admin/access";
import { listClients } from "@/lib/admin/service";
import { handleError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return Response.json({ clients: await listClients({ query: q.slice(0, 80) }) });
  } catch (e) {
    return handleError(e);
  }
}
