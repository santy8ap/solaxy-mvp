/** Registro estructurado (JSON, una línea) de los eventos de pago: se lee en los logs de Vercel. */
export function payLog(action: string, data: Record<string, unknown>) {
  if (process.env.VITEST) return;
  console.log(JSON.stringify({ tipo: "pago", accion: action, ...data, at: new Date().toISOString() }));
}
