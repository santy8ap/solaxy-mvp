import { handleError } from "@/lib/api";
import { validateEnv } from "@/lib/env";

/** Endpoint de diagnóstico: devuelve problemas de configuración de variables de entorno. */
export async function GET() {
  try {
    const problems = validateEnv();
    const errors = problems.filter((p) => p.severity === "error");
    return Response.json({
      ok: errors.length === 0,
      problems,
      errors: errors.length,
      warnings: problems.filter((p) => p.severity === "warning").length,
    });
  } catch (e) {
    return handleError(e);
  }
}