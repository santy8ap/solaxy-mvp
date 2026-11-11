import Link from "next/link";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { signInHref } from "@/lib/navigation";
import { Logo } from "@/components/ui/logo";

export function PublicFrame({
  children,
  active,
  signInDestination,
  authenticated = false,
}: {
  children: ReactNode;
  active?: "planes" | "planta" | "ayuda";
  signInDestination?: string;
  authenticated?: boolean;
}) {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="eclipse-header">
        <nav
          className="eclipse-wrap eclipse-navigation public-navigation"
          aria-label="Principal"
        >
          <Link href="/" aria-label="In World Energy, inicio">
            <Logo />
          </Link>
          <div className="public-nav-links">
            {[
              ["planes", "Planes"],
              ["planta", "La planta"],
              ["ayuda", "Ayuda"],
            ].map(([path, label]) => (
              <Link
                key={path}
                href={`/${path}`}
                aria-current={active === path ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </div>
          <Link
            href={authenticated ? "/panel" : signInHref(signInDestination ?? (active === "planes" ? "/panel/planes" : "/panel"))}
            className="btn btn-ghost"
          >
            {authenticated ? "Mi cuenta ↗" : "Ingresar ↗"}
          </Link>
        </nav>
      </header>
      <main id="contenido" className="eclipse-wrap public-content">
        {children}
      </main>
      <Toaster />
      <footer className="eclipse-wrap public-footer">
        <Logo />
        <span className="eyebrow">ENERGÍA SOLAR. VISIÓN EMPRESARIAL.</span>
        <Link href="/privacidad">Privacidad ↗</Link>
        <Link href="/terminos">Términos ↗</Link>
      </footer>
    </>
  );
}
