import { redirect } from "next/navigation";
import { getAuthContext, grantAdmin, hasAdminIntent } from "@/lib/admin/access";
import { adminEmailAllowed } from "@/lib/env";

/** Google vuelve aquí cuando se eligió "Administrador": convierte la intención en modo admin. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
  // Si el correo no está autorizado, /admin muestra el aviso en lugar del panel.
  if ((await hasAdminIntent()) && adminEmailAllowed(ctx.user.email)) {
    await grantAdmin(ctx.user.id, ctx.sessionToken);
    redirect("/admin");
  }
  redirect((await hasAdminIntent()) ? "/admin" : "/panel");
}
