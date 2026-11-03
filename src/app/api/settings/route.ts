import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { ensureReady } from "@/lib/db/init";

/** Configuración pública de la planta (la que usa el navegador para sus cálculos). */
export async function GET() {
  try {
    await connection();
    const { settings } = await ensureReady();
    return Response.json(settings);
  } catch (e) {
    return handleError(e);
  }
}
