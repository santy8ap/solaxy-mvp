import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import {
  attachCryptoHash,
  markRefunded,
  reverifyPayment,
  reconcilePayment,
} from "@/lib/admin/payments";
import { handleError, readJson } from "@/lib/api";
import { confirmTransfer, rejectTransfer } from "@/lib/payments/transfer";
import { safeText } from "@/lib/security/text";

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
    reference: safeText(160, { min: 4, label: "La referencia del reembolso" }),
  }),
  z.object({
    action: z.literal("conciliar"),
    reference: safeText(500, { min: 12, label: "La conciliación" }),
  }),
  // Transferencias que reporta la empresa: el servicio valida la referencia y el motivo.
  z.object({ action: z.literal("confirmar_transferencia"), reference: z.string().max(200) }),
  z.object({ action: z.literal("rechazar_transferencia"), reason: z.string().max(400) }),
]);

/** Acciones del admin sobre un pago: re-verificar, registrar el hash, marcar el reembolso o revisar una transferencia. */
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
    switch (b.action) {
      case "reverificar":
        return Response.json(await reverifyPayment(actor, id));
      case "registrar_hash":
        return Response.json(await attachCryptoHash(actor, id, b.txHash));
      case "conciliar":
        return Response.json(await reconcilePayment(actor, id, b.reference));
      case "reembolsado":
        return Response.json(await markRefunded(actor, id, b.reference));
      case "confirmar_transferencia":
        return Response.json(await confirmTransfer(actor, id, b.reference));
      case "rechazar_transferencia":
        return Response.json(await rejectTransfer(actor, id, b.reason));
    }
  } catch (e) {
    return handleError(e);
  }
}
