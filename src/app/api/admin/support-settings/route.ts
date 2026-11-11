import { requireAdminApi } from "@/lib/admin/access";
import { audit } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";
import { saveSupport } from "@/lib/support";
export async function PUT(req: Request) {
  try {
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    const support = await saveSupport(await readJson(req));
    await audit(
      { id: ctx.user.id, name: ctx.user.name },
      "config_planta",
      "Actualizó los contactos oficiales de soporte",
      { support },
    );
    return Response.json(support);
  } catch (error) {
    return handleError(error);
  }
}
