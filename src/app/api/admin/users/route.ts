import { requireAdminApi } from "@/lib/admin/access";
import { listUsersForAdmin, type UserScope } from "@/lib/admin/service";
import { handleError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    const url = new URL(req.url);
    const scope = (["todos", "reales", "comunidad"].includes(url.searchParams.get("scope") ?? "") ? url.searchParams.get("scope") : "todos") as UserScope;
    return Response.json({ users: await listUsersForAdmin({ query: url.searchParams.get("q") ?? "", scope }) });
  } catch (e) {
    return handleError(e);
  }
}
