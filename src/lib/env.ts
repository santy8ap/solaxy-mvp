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

const FALLBACK_SECRET = "iwe-pruebas-secreto-cambiar-en-produccion-7f3a9c21e8b4";
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
  return FALLBACK_SECRET;
}

/** PIN de administrador. null = acceso de administrador desactivado (falta ADMIN_PIN en producción). */
export function adminPin(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  if (pin) return pin;
  return strict() ? null : "2026";
}

/** Correos autorizados para el modo administrador (ADMIN_EMAILS, separados por comas). */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Quién puede entrar al modo administrador, además de saber el PIN: los correos de ADMIN_EMAILS.
 * La cuenta de pruebas también puede, pero solo mientras el modo de pruebas esté activo.
 * Sin ADMIN_EMAILS, ninguna otra cuenta administra.
 */
export function adminEmailAllowed(email: string) {
  const normalized = email.trim().toLowerCase();
  if (isDemoMode() && normalized === env.demoEmail) return true;
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
  for (let port = 3000; port <= 3005; port++) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (v) origins.add(`https://${v}`);
  }
  return [...origins];
}
