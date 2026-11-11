import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { alertFailure } from "@/lib/alerts";
import { MarketError } from "@/lib/errors";

/** Convierte errores conocidos en respuestas JSON claras para la interfaz. */
export function handleError(err: unknown) {
  // Las señales internas de Next (prerender, redirect…) no son errores de la app.
  unstable_rethrow(err);
  if (err instanceof MarketError) return Response.json({ ...err.extra, error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    return Response.json({ error: err.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  console.error("[iwe] error en API:", err);
  const name = (err as { name?: string })?.name || "Error";
  const message = String((err as { message?: unknown })?.message ?? err);
  alertFailure(`api:${name}:${message.slice(0, 80)}`, "error inesperado en la API", `${name}: ${message}`);
  return Response.json({ error: "Error inesperado del servidor" }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
