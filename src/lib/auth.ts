import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { BRAND } from "@/config/brand";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { authSecret, baseUrl, env, googleEnabled, trustedOrigins } from "@/lib/env";

export const auth = betterAuth({
  appName: BRAND.name,
  baseURL: baseUrl(),
  secret: authSecret(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: { enabled: true, autoSignIn: true },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.googleClientId,
          clientSecret: env.googleClientSecret,
          prompt: "select_account",
        },
      }
    : {},
  trustedOrigins: trustedOrigins(),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: { cookiePrefix: "solaxy" },
  telemetry: { enabled: false },
  // nextCookies debe ir de último: permite iniciar sesión desde Server Actions.
  plugins: [nextCookies()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
