import { isAddress } from "viem";
import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { linkWallet } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

const Body = z.object({
  address: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida"),
  walletName: z.string().min(1).max(40),
  chainId: z.number().int().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    await linkWallet(user.id, Body.parse(await readJson(req)));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
