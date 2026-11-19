import { inArray, sql } from "drizzle-orm";
import { connection } from "next/server";
import { requireAdminApi } from "@/lib/admin/access";
import { handleError } from "@/lib/api";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { jobState } from "@/lib/db/schema";
import { cronConfigured } from "@/lib/jobs/auth";

const JOBS = [
  { id: "reconcile-tick", label: "Conciliación de pagos con las visitas", every: "Como máximo cada 2 minutos, cuando alguien visita la página." },
  { id: "cron-payments", label: "Pasada diaria (cron de Vercel)", every: "Una vez al día: pagos pendientes, devoluciones de los últimos 180 días y mantenimiento." },
  { id: "mantenimiento", label: "Mantenimiento", every: "Como máximo cada hora: cierra órdenes abandonadas, borra sesiones vencidas y envía recordatorios." },
  { id: "cuadre", label: "Cuadre de los números", every: "Una vez al día, con la pasada diaria: te escribe si algo no cuadra." },
] as const;

/** Cómo está la página por dentro: versión, base de datos y la última pasada de cada tarea automática. */
export async function GET() {
  try {
    await connection();
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    await ensureReady();
    const started = Date.now();
    await db.run(sql`SELECT 1`);
    const latencyMs = Date.now() - started;
    const rows = await db
      .select({ id: jobState.id, updatedAt: jobState.updatedAt })
      .from(jobState)
      .where(
        inArray(
          jobState.id,
          JOBS.map((j) => j.id),
        ),
      );
    return Response.json(
      {
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
        environment: process.env.VERCEL_ENV ?? "local",
        database: { latencyMs },
        cronConfigured: cronConfigured(),
        jobs: JOBS.map((j) => ({ ...j, lastRunAt: rows.find((r) => r.id === j.id)?.updatedAt ?? null })),
        checkedAt: Date.now(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
