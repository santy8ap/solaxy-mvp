"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureReady } from "@/lib/db/init";
import { env } from "@/lib/env";

/** Inicia sesión con la cuenta demo (no necesita Google ni internet). */
export async function signInDemo() {
  await ensureReady();
  await auth.api.signInEmail({
    body: { email: env.demoEmail, password: env.demoPassword },
    headers: await headers(),
  });
  redirect("/panel");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
