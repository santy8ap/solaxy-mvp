import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { syncWompiTransaction } from "@/lib/payments/wompi-service";
import { toTxDTO } from "@/lib/portfolio";
import { syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object({ id: z.string().min(3).max(120).regex(/^[\w-]+$/, "Transacción inválida") });

/** Al volver del checkout: consulta la transacción en Wompi y actualiza la orden. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = Body.parse(await readJson(req));
    if (!syncLimiter.hit(user.id)) return jsonError("Demasiadas consultas seguidas. Espera un momento.", 429);
    const r = await syncWompiTransaction(id);
    // Solo el dueño de la orden puede verla.
    if (!r || r.order.userId !== user.id) return jsonError("No encontramos ese pago en tu cuenta.", 404);
    return Response.json({ order: toTxDTO(r.order), outcome: r.outcome });
  } catch (e) {
    return handleError(e);
  }
}
