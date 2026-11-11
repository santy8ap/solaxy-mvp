import "server-only";

/** Configuración del servidor leída de variables de entorno (.env.local o Vercel). */
export const env = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /** kW de demostración que recibe cada cuenta nueva (0 = desactivado). Solo en modo demo. */
  starterKw: Math.max(0, Number(process.env.DEMO_STARTER_KW ?? 5) || 0),
  demoEmail: "demo@solaxy.local",
  demoPassword: process.env.DEMO_PASSWORD || "solaxy-demo-2026",
  demoName: "Inversionista Demo",
};

export const googleEnabled = Boolean(env.googleClientId && env.googleClientSecret);

/**
 * Modo demo: cuenta demo, wallet demo, pagos simulados y posición de regalo.
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

/** Clave efímera por proceso de desarrollo (no se persiste, solo sirve para la sesión actual de `next dev`). */
let devSecret: string | null = null;

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
  // Modo demo local sin variable: generar una clave aleatoria por proceso. Nunca un valor fijo en el código.
  devSecret ??= `dev-${crypto.randomUUID()}-${crypto.randomUUID()}`;
  return devSecret;
}

/** PIN de administrador. null = acceso de administrador desactivado (falta ADMIN_PIN). Nunca hay un valor por defecto. */
export function adminPin(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  if (pin) return pin;
  return null;
}

/** Correos autorizados para el modo administrador (ADMIN_EMAILS, separados por comas). */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Con dinero real, el PIN no basta: el correo debe estar en ADMIN_EMAILS.
 * En modo demo, si la lista está vacía, solo la cuenta de demostración puede ser administradora.
 * Si nunca se configura ADMIN_EMAILS, ningún otro usuario accede al panel de administración.
 */
export function adminEmailAllowed(email: string) {
  const list = adminEmails();
  const normalized = email.trim().toLowerCase();
  if (list.length === 0) return isDemoMode() && normalized === env.demoEmail;
  return list.includes(normalized);
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
  // Puerto principal de desarrollo (evitar abrir OAuth a puertos innecesarios).
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (v) origins.add(`https://${v}`);
  }
  return [...origins];
}

/**
 * Valida las variables de entorno críticas y devuelve una lista de problemas.
 * Cada problema es { severity: "error" | "warning", variable, message }.
 * Llamar al arranque (setup.mjs, middleware o una ruta de healthcheck)
 * para detectar configuraciones faltantes antes de que afecten a los usuarios.
 */
export function validateEnv(): { severity: "error" | "warning"; variable: string; message: string }[] {
  const problems: { severity: "error" | "warning"; variable: string; message: string }[] = [];
  const isStrict = strict();

  if (!process.env.BETTER_AUTH_SECRET) {
    if (isStrict) {
      problems.push({
        severity: "error",
        variable: "BETTER_AUTH_SECRET",
        message: "Obligatoria en producción y con dinero real. Genérala con npm run setup.",
      });
    } else {
      problems.push({
        severity: "warning",
        variable: "BETTER_AUTH_SECRET",
        message: "Falta en modo demo local: las sesiones usarán una clave efímera por proceso (no persisten entre reinicios).",
      });
    }
  }

  if (!process.env.ADMIN_PIN) {
    problems.push({
      severity: isStrict ? "error" : "warning",
      variable: "ADMIN_PIN",
      message: isStrict
        ? "Obligatoria para acceder al panel de administración."
        : "Falta en modo demo: el panel de administración estará bloqueado hasta que se configure.",
    });
  }

  if (!process.env.BETTER_AUTH_URL) {
    problems.push({
      severity: "warning",
      variable: "BETTER_AUTH_URL",
      message: "Recomendada para OAuth y cookies. Por defecto se usa http://localhost:3000.",
    });
  }

  if (!isDemoMode()) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      problems.push({
        severity: "error",
        variable: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
        message: "Obligatorias con dinero real (DEMO_MODE=false): solo Google puede autenticar.",
      });
    }
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      problems.push({
        severity: "warning",
        variable: "MERCADOPAGO_ACCESS_TOKEN",
        message: "Sin ella, Mercado Pago (tarjeta, PSE, Nequi) no estará disponible.",
      });
    }
    if (!process.env.CRYPTO_TREASURY_ADDRESS) {
      problems.push({
        severity: "warning",
        variable: "CRYPTO_TREASURY_ADDRESS",
        message: "Sin ella, los pagos con cripto (USDT, BNB) no estarán disponibles.",
      });
    }
  }

  if (!isDemoMode() && process.env.MERCADOPAGO_ACCESS_TOKEN && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    problems.push({
      severity: "error",
      variable: "MERCADOPAGO_WEBHOOK_SECRET",
      message: "Obligatoria con dinero real: sin ella los webhooks de Mercado Pago se rechazan (evita fraude).",
    });
  }

  return problems;
}
