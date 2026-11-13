import { isAddress } from "viem";
import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { TOO_MANY_SYNCS, syncLimiter } from "@/lib/security/limits";
import { linkWallet } from "@/lib/withdrawals";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";
import { safeText } from "@/lib/security/text";

const Body = z.object({
  address: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida"),
  walletName: safeText(40, { min: 1, label: "El nombre de la wallet" }),
  chainId: z.number().int().nullable(),
});

/** Recuerda la última wallet que conectó el usuario. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await syncLimiter.hit(user.id))) return jsonError(TOO_MANY_SYNCS, 429);
    await linkWallet(user.id, b);
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
