import { handleError } from "@/lib/api";
import { getOrder } from "@/lib/orders";
import { verifyCryptoOrder } from "@/lib/payments/crypto-service";
import { toTxDTO } from "@/lib/portfolio";
import { syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

/** Estado de un pago cripto; si está verificando, consulta la cadena otra vez. */
export async function GET(_req: Request, ctx: RouteContext<"/api/payments/crypto/[id]">) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order || order.userId !== user.id || order.method !== "crypto") return jsonError("Orden no encontrada", 404);
    if (!(await syncLimiter.hit(user.id))) return jsonError("Demasiadas consultas seguidas. Espera un momento.", 429);
    const s = await verifyCryptoOrder(id);
    return Response.json({ order: toTxDTO(s.order), state: s.state, confirmations: s.confirmations, needed: s.needed });
  } catch (e) {
    return handleError(e);
  }
}
