import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { alertFailure } from "@/lib/alerts";
import { MarketError } from "@/lib/errors";
import { randomHex } from "@/lib/ids";

/** Código corto de un error inesperado: lo ve quien llamó y queda en el registro y en la alerta con el mismo valor. */
export const errorRef = () => `ERR-${randomHex(3).toUpperCase()}`;

/** Convierte errores conocidos en respuestas JSON claras para la interfaz. */
export function handleError(err: unknown) {
  // Las señales internas de Next (prerender, redirect…) no son errores de la app.
  unstable_rethrow(err);
  if (err instanceof MarketError) return Response.json({ ...err.extra, error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    return Response.json({ error: err.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const ref = errorRef();
  const name = (err as { name?: string })?.name || "Error";
  const message = String((err as { message?: unknown })?.message ?? err);
  const stack = (err as { stack?: unknown })?.stack;
  // Una línea JSON por error: en Vercel › Logs se encuentra buscando el código que vio el usuario.
  console.error(
    JSON.stringify({
      tipo: "error_api",
      ref,
      nombre: name,
      mensaje: message.slice(0, 1000),
      ...(typeof stack === "string" && { pila: stack.split("\n").slice(1, 7).map((l) => l.trim()).join(" | ") }),
    }),
  );
  alertFailure(`api:${name}:${message.slice(0, 80)}`, "error inesperado en la API", `${name}: ${message} (código ${ref})`);
  return Response.json({ error: `Algo falló de nuestro lado. Si se repite, escríbenos con el código ${ref}.`, ref }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
