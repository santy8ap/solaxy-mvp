import { isAddress } from "viem";
import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { createCryptoQuote } from "@/lib/payments/crypto-service";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z
  .object({
    kw: z.number().positive().optional(),
    listingId: z.string().min(1).max(80).optional(),
    asset: z.enum(["USDT", "BNB"]),
    payer: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida"),
    walletName: z.string().min(1).max(40),
  })
  .refine((b) => (b.kw != null) !== (b.listingId != null), "Indica los kW o una oferta del mercado");

/** Cotiza con el precio en vivo y crea la orden cripto con el monto exacto. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!orderLimiter.hit(user.id)) return jsonError(TOO_MANY_ORDERS, 429);
    const quote = await createCryptoQuote({ userId: user.id, kw: b.kw, listingId: b.listingId, asset: b.asset, payer: b.payer, walletName: b.walletName });
    return Response.json(quote, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
