import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { BRAND } from "@/config/brand";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { authSecret, baseUrl, env, googleEnabled, isDemoMode, trustedOrigins } from "@/lib/env";
import { betterAuthRateLimitStorage } from "@/lib/security/db-rate-limit";

export const auth = betterAuth({
  appName: BRAND.name,
  baseURL: baseUrl(),
  secret: authSecret(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  // Correo y contraseña solo existe para la cuenta de pruebas, que crea el servidor (lib/db/seed).
  // Nadie puede registrarse por su cuenta. Con dinero real se entra únicamente con Google.
  emailAndPassword: { enabled: isDemoMode(), disableSignUp: true },
  // 5 intentos de contraseña por minuto por IP; el resto de rutas de ingreso, 100 por minuto.
  // Se cuentan en la base para que el límite valga entre todas las instancias de Vercel.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
    customStorage: betterAuthRateLimitStorage(),
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.googleClientId,
          clientSecret: env.googleClientSecret,
          prompt: "select_account",
          // Cada ingreso trae el nombre y la foto vigentes de Google (los datos personales del perfil no cambian).
          overrideUserInfoOnSignIn: true,
        },
      }
    : {},
  trustedOrigins: trustedOrigins(),
  // Rutas de la librería que la página no usa. Cerradas, nadie puede cambiar por fuera su nombre, su foto
  // (vienen de Google), su correo o su contraseña, ni vincular cuentas o leer los tokens de Google.
  // La página solo usa: entrar con Google, la cuenta de pruebas, la sesión y salir.
  disabledPaths: [
    "/update-user",
    "/change-email",
    "/change-password",
    "/verify-password",
    "/delete-user",
    "/delete-user/callback",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/verify-email",
    "/link-social",
    "/unlink-account",
    "/list-accounts",
    "/account-info",
    "/get-access-token",
    "/refresh-token",
    "/update-session",
    "/list-sessions",
    "/revoke-session",
    "/revoke-sessions",
    "/revoke-other-sessions",
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: { cookiePrefix: "iwe" },
  telemetry: { enabled: false },
  // nextCookies debe ir de último: permite iniciar sesión desde Server Actions.
  plugins: [nextCookies()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
