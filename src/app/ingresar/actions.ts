"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAdminPin, clearAdmin, getAuthContext, grantAdmin, setAdminIntent } from "@/lib/admin/access";
import { auth } from "@/lib/auth";
import { ensureReady } from "@/lib/db/init";
import { env } from "@/lib/env";

export type ActionState = { error?: string } | undefined;

/** Cuenta demo, como inversionista o como administrador (con PIN). */
export async function signInDemo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const asAdmin = formData.get("role") === "admin";
  if (asAdmin) {
    const pin = await checkAdminPin(String(formData.get("pin") ?? ""));
    if (!pin.ok) return { error: pin.error };
  }
  await ensureReady();
  const res = await auth.api.signInEmail({
    body: { email: env.demoEmail, password: env.demoPassword },
    headers: await headers(),
  });
  if (asAdmin) await grantAdmin(res.user.id, res.token);
  else await clearAdmin();
  redirect(asAdmin ? "/admin" : "/panel");
}

/** Antes de abrir Google: valida el PIN (si eligió administrador) o limpia un rol anterior. */
export async function prepareGoogleLogin(role: "user" | "admin", pin: string): Promise<ActionState> {
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
export async function becomeAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
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
