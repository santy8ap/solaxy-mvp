import { handleError } from "@/lib/api";
import { receiptData, renderReceipt } from "@/lib/receipts";
import { TOO_MANY_SYNCS, syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

/** El comprobante en PDF de un movimiento propio. */

export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/receipts/[id]">,
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await params;
    if (!/^[A-Za-z0-9-]{1,80}$/.test(id))
      return jsonError("Referencia inválida", 400);
    // Armar un PDF cuesta: el mismo límite de las consultas de pagos.
    if (!(await syncLimiter.hit(user.id))) return jsonError(TOO_MANY_SYNCS, 429);
    const data = await receiptData(user.id, id);
    const bytes = await renderReceipt(data);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="comprobante-${id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
