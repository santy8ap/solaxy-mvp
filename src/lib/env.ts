import "server-only";

/** Configuración del servidor leída de variables de entorno (.env.local o Vercel). */
export const env = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /** Cuenta de pruebas: solo existe en modo de pruebas (DEMO_MODE distinto de false). */
  demoEmail: "pruebas@inworldenergy.local",
  demoPassword: process.env.DEMO_PASSWORD || "iwe-pruebas-2026",
  demoName: "Empresa de Pruebas",
};

export const googleEnabled = Boolean(env.googleClientId && env.googleClientSecret);

/**
 * Modo de pruebas: cuenta de pruebas, pago de prueba y pagos de prueba de Mercado Pago o de testnet.
 * Activo salvo que DEMO_MODE sea "false" (o "0", "no", "off"): entonces solo se cobra de verdad.
 */
export function isDemoMode() {
  const v = (process.env.DEMO_MODE ?? "").trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(v);
}

/** En Vercel o con dinero real no se aceptan valores de respaldo para las claves. */
function strict() {
  return Boolean(process.env.VERCEL) || !isDemoMode();
}

/** Solo para `next build`: nadie inicia sesión durante el build, así que basta una clave efímera. */
let buildSecret: string | null = null;

export function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (strict()) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      buildSecret ??= `build-${crypto.randomUUID()}-${crypto.randomUUID()}`;
      return buildSecret;
    }
    throw new Error("Falta BETTER_AUTH_SECRET: configúrala en las variables de entorno (en local, con npm run setup).");
  }
  // En local sin BETTER_AUTH_SECRET (npm run setup la crea): una clave aleatoria para este proceso, nunca una
  // escrita en el código. Va en globalThis para que sea la misma aunque el módulo se cargue más de una vez.
  const g = globalThis as unknown as { __iweDevSecret?: string };
  g.__iweDevSecret ??= `dev-${crypto.randomUUID()}-${crypto.randomUUID()}`;
  return g.__iweDevSecret;
}

/** PIN de administrador. null = acceso de administrador desactivado (falta ADMIN_PIN en producción). */
export function adminPin(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  // Sin ADMIN_PIN nadie entra al admin: no hay un PIN por defecto (npm run setup genera uno).
  return pin || null;
}

/** Correos autorizados para el modo administrador (ADMIN_EMAILS, separados por comas). */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Quién puede entrar al modo administrador, además de saber el PIN: solo los correos de ADMIN_EMAILS.
 * La cuenta de pruebas no es la excepción: administra solo si su correo está en la lista, y solo
 * mientras el modo de pruebas esté activo. Sin ADMIN_EMAILS, nadie administra.
 */
export function adminEmailAllowed(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized === env.demoEmail && !isDemoMode()) return false;
  return adminEmails().includes(normalized);
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
  // El puerto de desarrollo; otro puerto local entra solo si es el de BETTER_AUTH_URL.
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (v) origins.add(`https://${v}`);
  }
  return [...origins];
}
