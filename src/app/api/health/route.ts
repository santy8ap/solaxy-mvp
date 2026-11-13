import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";

/**
 * Para un monitor externo (UptimeRobot, Better Stack…): 200 si la página y su base de datos responden; 503 si la
 * base no contesta. Solo dice eso y la versión publicada: nada de configuración ni secretos.
 */
export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const started = Date.now();
  try {
    await ensureReady();
    await db.run(sql`SELECT 1`);
    return Response.json({ ok: true, database: "ok", latencyMs: Date.now() - started, version }, { headers });
  } catch {
    return Response.json({ ok: false, database: "error", version }, { status: 503, headers });
  }
}
