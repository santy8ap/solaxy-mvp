"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkAdminPin,
  clearAdmin,
  getAuthContext,
  grantAdmin,
  setAdminIntent,
} from "@/lib/admin/access";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ensureDemoAccount } from "@/lib/db/seed";
import { PLANS } from "@/config/plans";
import { planCheckoutHref, safeReturnTo } from "@/lib/navigation";
import { adminEmailAllowed, env, isDemoMode } from "@/lib/env";

export type ActionState = { error?: string } | undefined;

const NOT_ALLOWED =
  "Tu cuenta no está autorizada como administradora. Pide que agreguen tu correo a ADMIN_EMAILS.";

/** A dónde va una empresa al entrar: al plan que eligió en el inicio, o a su panel. */
function panelDestination(planId: unknown, returnTo: unknown) {
  return (
    safeReturnTo(returnTo) ??
    (PLANS.some((p) => p.id === planId)
      ? planCheckoutHref(String(planId))
      : "/panel")
  );
}

/** Cuenta de pruebas, como empresa o como administrador (con PIN). Solo en modo de pruebas. */
export async function signInDemo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isDemoMode())
    return {
      error:
        "La cuenta de pruebas está desactivada. Ingresa con tu cuenta de Google.",
    };
  const asAdmin = formData.get("role") === "admin";
  if (asAdmin) {
    const pin = await checkAdminPin(String(formData.get("pin") ?? ""));
    if (!pin.ok) return { error: pin.error };
  }
  await ensureReady();
  await ensureDemoAccount(db);
  const res = await auth.api.signInEmail({
    body: { email: env.demoEmail, password: env.demoPassword },
    headers: await headers(),
  });
  if (asAdmin) await grantAdmin(res.user.id, res.token);
  else await clearAdmin();
  redirect(
    asAdmin
      ? "/admin"
      : panelDestination(formData.get("plan"), formData.get("next")),
  );
}

/** Antes de abrir Google: valida el PIN (si eligió administrador) o limpia un rol anterior. */
export async function prepareGoogleLogin(
  role: "user" | "admin",
  pin: string,
): Promise<ActionState> {
  if (role === "admin") {
    const r = await checkAdminPin(pin);
    if (!r.ok) return { error: r.error };
    await setAdminIntent();
    return {};
  }
  await clearAdmin();
  return {};
}

/** Desde una sesión ya iniciada: entrar al modo administrador con el PIN. */
export async function becomeAdmin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
  if (!adminEmailAllowed(ctx.user.email)) return { error: NOT_ALLOWED };
  const pin = await checkAdminPin(String(formData.get("pin") ?? ""));
  if (!pin.ok) return { error: pin.error };
  await grantAdmin(ctx.user.id, ctx.sessionToken);
  redirect("/admin");
}

export async function leaveAdmin() {
  await clearAdmin();
  redirect("/panel");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  await clearAdmin();
  redirect("/");
}
