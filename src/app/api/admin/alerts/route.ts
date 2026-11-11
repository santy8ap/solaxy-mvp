import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { alertConfig, alertMessages, deliverAlert } from "@/lib/alerts";
import { handleError } from "@/lib/api";
import { createDbRateLimiter } from "@/lib/security/db-rate-limit";
import { jsonError } from "@/lib/session";

/** Pruebas de las alertas: 5 cada 10 minutos por administrador (cada una gasta un envío de Resend). */
const testLimiter = createDbRateLimiter({ name: "alerta-prueba", max: 5, windowMs: 10 * 60_000 });

/** Si las alertas por correo están listas y a qué correos llegan. */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const cfg = alertConfig();
    return Response.json({ enabled: cfg.enabled, hasKey: Boolean(process.env.RESEND_API_KEY?.trim()), to: cfg.to });
  } catch (e) {
    return handleError(e);
  }
}

/** Envía un correo de prueba ya mismo y dice cómo le fue con cada destinatario. */
export async function POST() {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const cfg = alertConfig();
    if (!process.env.RESEND_API_KEY?.trim()) return jsonError("Falta RESEND_API_KEY en Vercel (Production). Agrégala y vuelve a desplegar.", 412);
    if (!cfg.enabled) return jsonError("No hay a quién enviarlas: agrega tu correo a ALERT_EMAIL o a ADMIN_EMAILS.", 412);
    if (!(await testLimiter.hit(admin.user.id))) return jsonError("Ya enviaste varias pruebas seguidas. Espera unos minutos.", 429);
    return Response.json({ results: await deliverAlert(alertMessages.test(), { config: cfg }) });
  } catch (e) {
    return handleError(e);
  }
}
