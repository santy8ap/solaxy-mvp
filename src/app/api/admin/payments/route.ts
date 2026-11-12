import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { listPayments, paymentFiltersFrom, paymentSummary } from "@/lib/admin/payments";
import { handleError } from "@/lib/api";

/** Órdenes de pago para la sección Pagos del admin (?estado=&metodo=&q=&cliente=). */
export async function GET(req: Request) {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const filters = paymentFiltersFrom(new URL(req.url).searchParams);
    const [payments, summary] = await Promise.all([listPayments(filters), paymentSummary()]);
    return Response.json({ payments, summary });
  } catch (e) {
    return handleError(e);
  }
}
