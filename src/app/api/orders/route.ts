import { isAddress } from "viem";
import { z } from "zod";
import { handleError, validateBody } from "@/lib/api";
import { createBuyOrder } from "@/lib/market";
import { ASSETS } from "@/lib/rates";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z
  .object({
    kw: z.number().positive().optional(),
    listingId: z.string().min(1).max(80).optional(),
    asset: z.enum(ASSETS),
    network: z.string().min(1).max(60),
    chainId: z.number().int().nullable(),
    walletAddress: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida").optional(),
    walletName: z.string().min(1).max(40),
    method: z.enum(["wallet", "qr"]),
  })
  .refine((b) => (b.kw != null) !== (b.listingId != null), "Indica los kW o una oferta del mercado")
  .refine((b) => b.method === "qr" || !!b.walletAddress, "Conecta una wallet para pagar");

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = await validateBody(req, Body);
    if (!(await orderLimiter.hit(user.id))) return jsonError(TOO_MANY_ORDERS, 429);
    const order = await createBuyOrder({
      userId: user.id,
      kw: b.kw,
      listingId: b.listingId,
      asset: b.asset,
      network: b.network,
      chainId: b.chainId,
      walletAddress: b.method === "qr" ? null : (b.walletAddress ?? null),
      walletName: b.method === "qr" ? "Pago QR (demo)" : b.walletName,
    });
    return Response.json(order, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
