import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { getCatalog } from "@/lib/plans/service";

/** Catálogo público: la curva solar, los planes con sus precios vigentes y el cupo de la planta. */
export async function GET() {
  try {
    await connection();
    return Response.json(await getCatalog());
  } catch (e) {
    return handleError(e);
  }
}
