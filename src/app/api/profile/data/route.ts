import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { isoColombiaDate } from "@/lib/history-filters";
import { exportPersonalData } from "@/lib/privacy";
import { TOO_MANY_SYNCS, syncLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

/** Descarga todo lo que guardamos de la cuenta (Ley 1581: acceso gratuito a los datos). */
export async function GET() {
  try {
    await connection();
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (!(await syncLimiter.hit(user.id))) return jsonError(TOO_MANY_SYNCS, 429);
    const data = await exportPersonalData(user.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mis-datos-${isoColombiaDate(Date.now())}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
