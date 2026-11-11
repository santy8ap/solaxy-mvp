import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodSchema } from "zod";
import { MarketError } from "@/lib/errors";

/** Convierte errores conocidos en respuestas JSON claras para la interfaz. */
export function handleError(err: unknown) {
  // Las señales internas de Next (prerender, redirect…) no son errores de la app.
  unstable_rethrow(err);
  if (err instanceof MarketError) return Response.json({ ...err.extra, error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    return Response.json({ error: err.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  console.error("[solaxy] error en API:", err);
  return Response.json({ error: "Error inesperado del servidor" }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Valida el cuerpo JSON contra un esquema Zod. Lanza ZodError si falla. */
export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await readJson(req);
  return schema.parse(body);
}
