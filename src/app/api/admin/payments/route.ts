import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { listPayments, paymentSummary, type PaymentFilter } from "@/lib/admin/payments";
import { handleError } from "@/lib/api";

const FILTERS: PaymentFilter[] = ["todos", "en_proceso", "confirmadas", "fallidas", "por_reembolsar"];
const METHODS = ["todos", "mercadopago", "crypto", "demo"] as const;

/** Órdenes de pago para la sección Pagos del admin. */
export async function GET(req: Request) {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const url = new URL(req.url);
    const estado = url.searchParams.get("estado") as PaymentFilter | null;
    const metodo = url.searchParams.get("metodo") as (typeof METHODS)[number] | null;
    const [payments, summary] = await Promise.all([
      listPayments({ status: estado && FILTERS.includes(estado) ? estado : "todos", method: metodo && METHODS.includes(metodo) ? metodo : "todos" }),
      paymentSummary(),
    ]);
    return Response.json({ payments, summary });
  } catch (e) {
    return handleError(e);
  }
}
