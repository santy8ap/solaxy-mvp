import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { listPayments, paymentFiltersFrom } from "@/lib/admin/payments";
import { handleError } from "@/lib/api";
import { csvLine } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { isoColombiaDate } from "@/lib/history-filters";

const STATUS: Record<string, string> = {
  pendiente: "Pendiente",
  verificando: "Verificando",
  confirmada: "Confirmado",
  fallida: "No aprobado",
  cancelada: "Cancelado",
  por_reembolsar: "Por reembolsar",
  reembolsada: "Reembolsado",
};
const METHOD: Record<string, string> = {
  mercadopago: "Mercado Pago",
  crypto: "Cripto",
  transferencia: "Transferencia bancaria",
  manual: "Registrado a mano",
  demo: "Pago de prueba",
};

/** Los pagos de la lista (con los mismos filtros) en CSV para la contabilidad. Máximo 10.000 filas. */
export async function GET(req: Request) {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const rows = await listPayments({ ...paymentFiltersFrom(new URL(req.url).searchParams), limit: 10_000 });
    let csv =
      "\ufeff" +
      csvLine(["Fecha (Colombia)", "Confirmado (Colombia)", "Orden", "Cliente", "NIT o documento", "Correo", "Plan", "Mes", "Energía kWh", "Medio", "Estado", "Monto COP", "Referencia del pago", "Comprobante o hash", "Nota"]);
    for (const p of rows)
      csv += csvLine([
        formatDateTime(p.createdAt),
        p.confirmedAt ? formatDateTime(p.confirmedAt) : "",
        p.id,
        p.companyName || p.userName,
        p.customerId,
        p.userEmail,
        p.planName,
        p.periodIndex,
        p.kwh,
        p.method ? (METHOD[p.method] ?? p.method) : "",
        STATUS[p.status] ?? p.status,
        p.amountCop,
        p.providerId,
        p.txHash,
        p.note,
      ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pagos-${isoColombiaDate(Date.now())}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
