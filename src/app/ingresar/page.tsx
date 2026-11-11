import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { googleEnabled, isDemoMode } from "@/lib/env";
import { Logo } from "@/components/ui/logo";
import { LiveMini } from "@/components/live/live-mini";
import { safeDestination } from "@/lib/navigation";
import { LoginOptions } from "./login-options";

export const metadata: Metadata = { title: "Ingresar" };

async function Options({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string; next?: string }>;
}) {
  // Se lee al momento de la visita: si agregas las credenciales de Google no hace falta recompilar.
  await connection();
  const { rol, next } = await searchParams;
  return (
    <LoginOptions
      googleEnabled={googleEnabled}
      demoMode={isDemoMode()}
      defaultRole={rol === "admin" ? "admin" : "user"}
      destination={safeDestination(next)}
    />
  );
}

async function DemoNote() {
  await connection();
  if (!isDemoMode()) return null;
  return (
    <p className="mt-6 text-xs leading-relaxed text-silver-500">
      {BRAND.demoBadge}. Las cuentas nuevas reciben una posición de demostración
      para explorar el panel.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
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
        <div className="login-intro">
          <h1 className="display max-w-[12ch] text-[clamp(2.6rem,4.6vw,4.2rem)] text-silver-50">
            TU ENERGÍA, EN UN SOLO LUGAR.
          </h1>
          <p className="mt-5 max-w-[42ch] text-lg text-silver-300">
            Accede a tu cuenta para consultar tu actividad, tus movimientos y la
            información de la planta.
          </p>
          <div className="mt-10 hidden max-w-[380px] lg:block">
            <LiveMini />
          </div>
        </div>
        <div className="panel cells mx-auto w-full max-w-[440px] p-7 sm:p-9">
          <h2 className="text-2xl font-semibold text-silver-50">
            Ingresar a {BRAND.name}
          </h2>
          <p className="mt-2 text-silver-400">
            Elige cómo quieres entrar y continúa con tu cuenta.
          </p>
          <div className="mt-8">
            <Suspense
              fallback={
                <div className="h-[260px] animate-pulse rounded-none bg-silicon-700/50" />
              }
            >
              <Options
                searchParams={
                  searchParams as Promise<{ rol?: string; next?: string }>
                }
              />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <DemoNote />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
