import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { listClients } from "@/lib/admin/service";
import { handleError } from "@/lib/api";
import { deletionBlockers } from "@/lib/privacy";

export async function GET(req: Request) {
  try {
    await connection();
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const clients = await listClients({ query: q.slice(0, 80) });
    // Para cada solicitud de eliminación abierta: qué impide eliminar la cuenta hoy.
    await Promise.all(
      clients.map(async (c) => {
        if (c.deletionRequest) c.deletionRequest.blockers = await deletionBlockers(c.id);
      }),
    );
    return Response.json({ clients });
  } catch (e) {
    return handleError(e);
  }
}
