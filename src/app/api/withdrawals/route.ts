import { isAddress } from "viem";
import { z } from "zod";
import { handleError, validateBody } from "@/lib/api";
import { createWithdrawal } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

const Body = z.object({
  amountCop: z.number().positive(),
  walletAddress: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida"),
  walletName: z.string().min(1).max(40),
  chainId: z.number().int().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = await validateBody(req, Body);
    return Response.json(await createWithdrawal({ userId: user.id, ...b }), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
