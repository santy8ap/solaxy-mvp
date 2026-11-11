import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { submitCryptoPayment } from "@/lib/payments/crypto-service";
import { toTxDTO } from "@/lib/portfolio";
import { syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object({ orderId: z.string().min(3).max(40), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Hash de transacción inválido") });

/** Registra el hash que devolvió la wallet y empieza la verificación en BNB Chain. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await syncLimiter.hit(user.id))) return jsonError("Demasiadas consultas seguidas. Espera un momento.", 429);
    const s = await submitCryptoPayment({ userId: user.id, orderId: b.orderId, txHash: b.txHash });
    return Response.json({ order: toTxDTO(s.order), state: s.state, confirmations: s.confirmations, needed: s.needed });
  } catch (e) {
    return handleError(e);
  }
}
