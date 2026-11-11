import { after, connection } from "next/server";
import { handleError } from "@/lib/api";
import { maybeReconcile } from "@/lib/jobs/tick";
import { getCatalog } from "@/lib/plans/service";

/** Catálogo público: la curva solar, los planes con sus precios vigentes y el cupo de la planta. */
export async function GET() {
  try {
    await connection();
    // Con cada visita, como máximo cada 2 minutos: concilia pagos sin esperar al cron diario.
    after(() => maybeReconcile());
    return Response.json(await getCatalog());
  } catch (e) {
    return handleError(e);
  }
}
