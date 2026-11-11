import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import {
  attachCryptoHash,
  markRefunded,
  reverifyPayment,
  reconcilePayment,
} from "@/lib/admin/payments";
import { handleError, readJson } from "@/lib/api";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reverificar") }),
  z.object({
    action: z.literal("registrar_hash"),
    txHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Hash de transacción inválido"),
  }),
  z.object({
    action: z.literal("reembolsado"),
    reference: z
      .string()
      .min(4, "Escribe la referencia del reembolso")
      .max(160),
  }),
  z.object({
    action: z.literal("conciliar"),
    reference: z.string().trim().min(12).max(500),
  }),
]);

/** Acciones del admin sobre un pago: re-verificar, registrar el hash o marcar el reembolso. */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/admin/payments/[id]">,
) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const { id } = await ctx.params;
    const b = Body.parse(await readJson(req));
    const actor = { id: admin.user.id, name: admin.user.name };
    const row =
      b.action === "reverificar"
        ? await reverifyPayment(actor, id)
        : b.action === "registrar_hash"
          ? await attachCryptoHash(actor, id, b.txHash)
          : b.action === "conciliar"
            ? await reconcilePayment(actor, id, b.reference)
            : await markRefunded(actor, id, b.reference);
    return Response.json(row);
  } catch (e) {
    return handleError(e);
  }
}
