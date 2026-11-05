import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { appConfig } from "@/lib/app-config";

/** Configuración pública: modo demo y qué medios de pago están activos. */
export async function GET() {
  try {
    await connection();
    return Response.json(appConfig());
  } catch (e) {
    return handleError(e);
  }
}
