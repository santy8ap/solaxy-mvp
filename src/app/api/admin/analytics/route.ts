import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { businessAnalytics } from "@/lib/admin/analytics";
import { handleError } from "@/lib/api";

/** Analítica del negocio para la sección Análisis del admin. */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    return Response.json(await businessAnalytics());
  } catch (e) {
    return handleError(e);
  }
}
