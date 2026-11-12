import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { handleError, readJson } from "@/lib/api";
import { getTransferAccount, saveTransferAccount } from "@/lib/payments/transfer";

/** La cuenta que ven los comercializadores para pagar por transferencia (null si no se ha configurado). */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    return Response.json({ account: await getTransferAccount() });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const account = await saveTransferAccount({ id: admin.user.id, name: admin.user.name }, await readJson(req));
    return Response.json({ account });
  } catch (e) {
    return handleError(e);
  }
}
