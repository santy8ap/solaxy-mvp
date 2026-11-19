import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { listWithdrawals } from "@/lib/admin/service";
import { withdrawalsCsv } from "@/lib/admin/withdrawals-export";
import { handleError } from "@/lib/api";
import { isoColombiaDate } from "@/lib/history-filters";

/** Todos los retiros (los por pagar primero) en CSV para la contabilidad. Máximo 10.000 filas. */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    return new Response(withdrawalsCsv(await listWithdrawals({ limit: 10_000 })), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="retiros-${isoColombiaDate(Date.now())}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
