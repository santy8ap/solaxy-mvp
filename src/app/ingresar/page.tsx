import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { googleEnabled } from "@/lib/env";
import { Logo } from "@/components/ui/logo";
import { LiveMini } from "@/components/live/live-mini";
import { LoginOptions } from "./login-options";

export const metadata: Metadata = { title: "Ingresar" };

async function Options() {
  // Se lee al momento de la visita: si agregas las credenciales de Google no hace falta recompilar.
  await connection();
  return <LoginOptions googleEnabled={googleEnabled} />;
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <Logo />
        </Link>
        <Link href="/" className="text-sm text-silver-400 hover:text-silver-50">
          Volver al inicio
        </Link>
      </div>
      <div className="mx-auto grid w-full max-w-[1100px] flex-1 items-center gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <div className="hidden lg:block">
          <h1 className="display max-w-[12ch] text-[clamp(2.6rem,4.6vw,4.2rem)] text-silver-50">Tu parte del sol te espera.</h1>
          <p className="mt-5 max-w-[42ch] text-lg text-silver-300">
            Entra para ver tus kW, la telemetría de la planta y tus ganancias creciendo en tiempo real.
          </p>
          <div className="mt-10 max-w-[380px]">
            <LiveMini />
          </div>
        </div>
        <div className="panel cells mx-auto w-full max-w-[440px] p-7 sm:p-9">
          <h2 className="text-2xl font-semibold text-silver-50">Ingresar a {BRAND.name}</h2>
          <p className="mt-2 text-silver-400">Usa tu cuenta de Google o entra con la cuenta demo.</p>
          <div className="mt-8">
            <Suspense fallback={<div className="h-[116px] animate-pulse rounded-2xl bg-silicon-700/50" />}>
              <Options />
            </Suspense>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-silver-500">
            {BRAND.demoBadge}. Las cuentas nuevas reciben una posición de demostración para explorar el panel.
          </p>
        </div>
      </div>
    </main>
  );
}
