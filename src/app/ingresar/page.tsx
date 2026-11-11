import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { PLANS } from "@/config/plans";
import { googleEnabled, isDemoMode } from "@/lib/env";
import { LoginClock } from "@/components/landing/login-clock";
import { Logo } from "@/components/ui/logo";
import { LoginOptions } from "./login-options";

export const metadata: Metadata = { title: "Ingresar" };

type Params = { rol?: string; plan?: string };

async function Options({ searchParams }: { searchParams: Promise<Params> }) {
  // Se lee al momento de la visita: si agregas las credenciales de Google no hace falta recompilar.
  await connection();
  const { rol, plan } = await searchParams;
  const chosen = PLANS.find((p) => p.id === plan);
  return (
    <>
      {chosen && (
        <p className="mb-7 border-l-2 border-ink pl-4 text-sm leading-relaxed text-fog">
          Elegiste el <strong className="font-medium text-ink">{chosen.name}</strong>. Entra como comercializador, completa tus datos personales y paga el primer mes.
        </p>
      )}
      <LoginOptions googleEnabled={googleEnabled} demoMode={isDemoMode()} defaultRole={rol === "admin" ? "admin" : "user"} planId={chosen?.id} />
      {isDemoMode() && <p className="mt-7 text-xs leading-relaxed text-mute">Página en modo de pruebas: la cuenta de pruebas y sus pagos no mueven dinero real.</p>}
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <Logo />
        </Link>
        <Link href="/" className="link text-sm text-fog">
          Volver al inicio
        </Link>
      </div>
      <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1240px] flex-1 items-center gap-16 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <LoginClock />
          <p className="mt-12 max-w-[44ch] leading-relaxed text-mute">Entra para ver la energía de tus planes, pagar el mes siguiente y retirar tu saldo.</p>
        </div>
        <div className="mx-auto w-full max-w-[440px]">
          <h1 className="display text-[clamp(3.5rem,9vw,5.5rem)]">Ingresar</h1>
          <div className="mt-10">
            <Suspense fallback={<div className="skeleton h-[280px]" />}>
              <Options searchParams={searchParams as Promise<Params>} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
