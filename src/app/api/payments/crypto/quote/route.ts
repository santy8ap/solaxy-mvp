import { isAddress } from "viem";
import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { createCryptoQuote } from "@/lib/payments/crypto-service";
import { PLAN_TARGET_ERROR, onePlanTarget, planTarget } from "@/lib/payments/plan-target";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z
  .object({
    ...planTarget,
    asset: z.enum(["USDT", "BNB"]),
    payer: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida"),
    walletName: z.string().min(1).max(40),
    proof: z.object({ signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(600), issuedAt: z.number().int().positive() }),
  })
  .refine(onePlanTarget, PLAN_TARGET_ERROR);

/** Cotiza el mes con el precio en vivo y crea la orden cripto con el monto exacto. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await orderLimiter.hit(user.id))) return jsonError(TOO_MANY_ORDERS, 429);
    const quote = await createCryptoQuote({ userId: user.id, ...b });
    return Response.json(quote, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
