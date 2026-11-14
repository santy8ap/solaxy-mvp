import { connection } from "next/server";
import { z } from "zod";
import { requireAdminApi, requireOwnerApi } from "@/lib/admin/access";
import { addAdmin, listTeam, removeAdmin } from "@/lib/admin/team";
import { handleError, readJson } from "@/lib/api";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("agregar"), email: z.string().max(254), note: z.string().max(400).optional() }),
  z.object({ action: z.literal("quitar"), email: z.string().max(254) }),
]);

/** El equipo de administración. Lo ve todo el equipo; solo los propietarios lo cambian. */
export async function GET() {
  try {
    await connection();
    const ctx = await requireAdminApi();
    if (ctx instanceof Response) return ctx;
    return Response.json({ team: await listTeam(), canManage: ctx.role === "propietario", me: ctx.user.email.toLowerCase() });
  } catch (e) {
    return handleError(e);
  }
}

/** Un propietario da o quita acceso de administrador a un correo de Google. */
export async function POST(req: Request) {
  try {
    const ctx = await requireOwnerApi();
    if (ctx instanceof Response) return ctx;
    const b = Body.parse(await readJson(req));
    const actor = { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email };
    if (b.action === "agregar") return Response.json({ member: await addAdmin(actor, b) }, { status: 201 });
    return Response.json(await removeAdmin(actor, b.email));
  } catch (e) {
    return handleError(e);
  }
}
