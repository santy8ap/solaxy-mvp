"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ensureDemoAccount } from "@/lib/db/seed";
import { PLANS } from "@/config/plans";
import { planCheckoutHref, safeReturnTo } from "@/lib/navigation";
import { adminEmailAllowed, env, isDemoMode } from "@/lib/env";

export type ActionState = { error?: string } | undefined;

/** A dónde va una empresa al entrar: al plan que eligió en el inicio, o a su panel. */
function panelDestination(planId: unknown, returnTo: unknown) {
  return (
    safeReturnTo(returnTo) ??
    (PLANS.some((p) => p.id === planId)
      ? planCheckoutHref(String(planId))
      : "/panel")
  );
}

/** Cuenta de pruebas, como empresa o como administrador. Solo en modo de pruebas. */
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
  // La cuenta de pruebas solo administra si su correo está en ADMIN_EMAILS.
  if (asAdmin && !adminEmailAllowed(env.demoEmail))
    return { error: "La cuenta de pruebas no es administradora en este ambiente." };
  await ensureReady();
  await ensureDemoAccount(db);
  await auth.api.signInEmail({
    body: { email: env.demoEmail, password: env.demoPassword },
    headers: await headers(),
  });
  redirect(
    asAdmin
      ? "/admin"
      : panelDestination(formData.get("plan"), formData.get("next")),
  );
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
