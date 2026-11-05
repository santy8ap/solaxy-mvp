import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { configStatus } from "@/lib/admin/config-status";
import { handleError } from "@/lib/api";

/** Qué falta para cobrar de verdad. Con ?probar=1 también prueba Wompi, el nodo y el precio en vivo. */
export async function GET(req: Request) {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const probes = new URL(req.url).searchParams.get("probar") === "1";
    return Response.json(await configStatus({ probes }));
  } catch (e) {
    return handleError(e);
  }
}
