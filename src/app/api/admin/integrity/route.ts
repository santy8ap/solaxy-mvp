import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { checkIntegrity } from "@/lib/admin/integrity";
import { handleError } from "@/lib/api";

/** El cuadre de los números, en vivo: lo que no cuadra y los pendientes que llevan días esperando. */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    return Response.json(await checkIntegrity(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
