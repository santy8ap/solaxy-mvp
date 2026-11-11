import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center px-5 sm:px-8">
          <Link href="/" aria-label={`${BRAND.name}, inicio`}>
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <p className="figure text-[clamp(6rem,24vw,16rem)] text-dim" aria-hidden="true">
          404
        </p>
        <h1 className="display mt-2 text-[clamp(2.75rem,7vw,5rem)]">Esta página no existe</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">Puede que el enlace esté mal escrito o que la página haya cambiado de lugar.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-solid">
            Ir al inicio
          </Link>
          <Link href="/panel" className="btn btn-ghost">
            Ir a mi panel
          </Link>
        </div>
      </main>
    </div>
  );
}
