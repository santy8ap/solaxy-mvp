import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { resetDemoData } from "@/lib/admin/demo-reset";
import { handleError, readJson } from "@/lib/api";

const Body = z.object({ confirm: z.string().max(40) });

/** Borra los datos de la etapa de pruebas (solo con DEMO_MODE=false y antes del primer pago real). */
export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const b = Body.parse(await readJson(req));
    return Response.json(await resetDemoData({ id: admin.user.id, name: admin.user.name }, b.confirm));
  } catch (e) {
    return handleError(e);
  }
}
