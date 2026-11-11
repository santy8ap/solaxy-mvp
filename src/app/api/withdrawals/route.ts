import { isAddress } from "viem";
import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createBankWithdrawal, createWalletWithdrawal } from "@/lib/withdrawals";
import { safeText } from "@/lib/security/text";

const Body = z.discriminatedUnion("to", [
  z.object({
    to: z.literal("banco"),
    amountCop: z.number().positive(),
    bank: z.string().max(60),
    accountType: z.string().max(20),
    accountNumber: z.string().max(40),
  }),
  z.object({
    to: z.literal("wallet"),
    amountCop: z.number().positive(),
    walletAddress: z.string().refine((a) => isAddress(a), "Dirección de wallet inválida"),
    walletName: safeText(40, { min: 1, label: "El nombre de la wallet" }),
    chainId: z.number().int().nullable(),
  }),
]);

/** Solicita un retiro: a una cuenta bancaria de la empresa, o a una wallet (devuelve el mensaje por firmar). */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (b.to === "banco") {
      const { amountCop, ...destination } = b;
      return Response.json({ withdrawal: await createBankWithdrawal({ userId: user.id, amountCop, destination }) }, { status: 201 });
    }
    return Response.json(await createWalletWithdrawal({ userId: user.id, amountCop: b.amountCop, walletAddress: b.walletAddress, walletName: b.walletName, chainId: b.chainId }), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
