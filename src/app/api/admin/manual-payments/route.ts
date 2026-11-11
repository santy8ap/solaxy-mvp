import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { registerManualPayment } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";
import { PLAN_TARGET_ERROR, onePlanTarget, planTarget } from "@/lib/payments/plan-target";
import { safeText } from "@/lib/security/text";

const Body = z
  .object({ ...planTarget, userId: z.string().min(1).max(80), reference: safeText(160, { min: 1, label: "La referencia" }) })
  .refine(onePlanTarget, PLAN_TARGET_ERROR);

/** Registra un pago recibido por fuera de la plataforma (transferencia bancaria) y activa el mes. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const b = Body.parse(await readJson(req));
    return Response.json({ payment: await registerManualPayment({ id: admin.user.id, name: admin.user.name }, b) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
