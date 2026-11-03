import "server-only";

/** Configuración del servidor leída de variables de entorno (.env.local o Vercel). */
export const env = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /** kW de demostración que recibe cada cuenta nueva (0 = desactivado) */
  starterKw: Math.max(0, Number(process.env.DEMO_STARTER_KW ?? 5) || 0),
  demoEmail: "demo@solaxy.local",
  demoPassword: process.env.DEMO_PASSWORD || "solaxy-demo-2026",
  demoName: "Inversionista Demo",
  /** PIN para entrar como administrador. En Vercel configúralo con ADMIN_PIN. */
  adminPin: process.env.ADMIN_PIN || "2026",
};

export const googleEnabled = Boolean(env.googleClientId && env.googleClientSecret);

const FALLBACK_SECRET = "solaxy-demo-secret-cambiar-en-produccion-7f3a9c21e8b4";

export function authSecret() {
  return process.env.BETTER_AUTH_SECRET || FALLBACK_SECRET;
}

/** URL pública de la app (para OAuth y cookies). */
export function baseUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function trustedOrigins() {
  const origins = new Set<string>([baseUrl()]);
  for (let port = 3000; port <= 3005; port++) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (v) origins.add(`https://${v}`);
  }
  return [...origins];
}
