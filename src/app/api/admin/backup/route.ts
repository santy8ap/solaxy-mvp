import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { audit } from "@/lib/admin/audit";
import { handleError } from "@/lib/api";
import { client } from "@/lib/db";
import { appliedMigrations, backupChunks } from "@/lib/db/backup-format";
import { ensureReady } from "@/lib/db/init";
import { isoColombiaDate } from "@/lib/history-filters";
import { createDbRateLimiter } from "@/lib/security/db-rate-limit";
import { jsonError } from "@/lib/session";

export const maxDuration = 60;

/** 5 respaldos por hora por administrador: cada uno lee la base completa. */
const backupLimiter = createDbRateLimiter({ name: "respaldos", max: 5, windowMs: 60 * 60_000 });

/**
 * El respaldo completo de los datos del negocio, en JSON (ver lib/db/backup-format). Se envía mientras se lee
 * la base. Tiene datos personales: queda constancia en la bitácora de quién lo descargó.
 */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    if (!(await backupLimiter.hit(admin.user.id))) return jsonError("Ya descargaste varios respaldos en la última hora. Espera un poco.", 429);
    await ensureReady();
    const migrations = await appliedMigrations(client);
    await audit({ id: admin.user.id, name: admin.user.name }, "descargar_respaldo", "Descargó un respaldo completo de los datos", { migraciones: migrations.length });
    const encoder = new TextEncoder();
    const chunks = backupChunks(client, { migrations });
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await chunks.next();
          if (done) controller.close();
          else controller.enqueue(encoder.encode(value));
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await chunks.return(undefined);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="respaldo-x-green-energy-${isoColombiaDate(Date.now())}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
