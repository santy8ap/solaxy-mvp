import { redirect } from "next/navigation";
import { getAuthContext, grantAdmin, hasAdminIntent } from "@/lib/admin/access";

/** Google vuelve aquí cuando se eligió "Administrador": convierte la intención en modo admin. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
  if (await hasAdminIntent()) {
    await grantAdmin(ctx.user.id, ctx.sessionToken);
    redirect("/admin");
  }
  redirect("/panel");
}
