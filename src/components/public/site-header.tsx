"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

const PUBLIC_LINKS = [
  ["/planes", "Planes de energía", "planes"],
  ["/planta", "La planta", "planta"],
  ["/ayuda", "Ayuda", "ayuda"],
] as const;
const HOME_LINKS = [
  ["#planta", "Ciclo solar", "ciclo"],
  ["#planes", "Planes de energía", "planes"],
  ["#como-funciona", "Cómo funciona", "proceso"],
  ["/planta", "La planta", "planta"],
  ["/ayuda", "Ayuda", "ayuda"],
] as const;

export function SiteHeader({
  landing = false,
  active,
  children,
  mobileActions,
}: {
  landing?: boolean;
  active?: "planes" | "planta" | "ayuda";
  children?: ReactNode;
  mobileActions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const links = landing ? HOME_LINKS : PUBLIC_LINKS;

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 761px)");
    const resize = () => { if (wide.matches) setOpen(false); };
    document.addEventListener("keydown", escape);
    wide.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", escape);
      wide.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <header className="eclipse-header site-header">
      {landing && <div className="home-scroll-progress" aria-hidden="true" />}
      <nav className="eclipse-wrap eclipse-navigation" aria-label="Principal">
        <Link href="/" aria-label="In World Energy, inicio" className="site-brand">
          <Logo />
        </Link>
        <div className="desktop-links">
          {links.map(([href, label, key]) => (
            <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          {children ?? (
            <Link href="/panel" prefetch={false} className="btn btn-ghost">
              Mi cuenta <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
          <button
            ref={toggle}
            type="button"
            className="menu-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </nav>
      {open && (
        <nav id={id} className="mobile-links site-mobile-links" aria-label="Navegación móvil">
          {links.map(([href, label, key], index) => (
            <Link key={key} href={href} onClick={() => setOpen(false)} aria-current={active === key ? "page" : undefined}>
              <span className="site-mobile-index mono">0{index + 1}</span>
              <span>{label}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
          {mobileActions}
        </nav>
      )}
    </header>
  );
}
