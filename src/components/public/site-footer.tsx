import Link from "next/link";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { BRAND } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="eclipse-wrap site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <Link href="/" aria-label="In World Energy, inicio"><Logo /></Link>
          <p>{BRAND.tagline}</p>
        </div>
        <nav aria-label="Explorar In World Energy">
          <span className="eyebrow">EXPLORA</span>
          <Link href="/planes">Planes de energía <ArrowUpRight size={13} aria-hidden="true" /></Link>
          <Link href="/planta">La planta <ArrowUpRight size={13} aria-hidden="true" /></Link>
          <Link href="/ayuda">Centro de ayuda <ArrowUpRight size={13} aria-hidden="true" /></Link>
        </nav>
        <a href="#contenido" className="site-back-top">Volver arriba <ArrowUp size={16} aria-hidden="true" /></a>
      </div>
      <div className="site-footer-bottom">
        <span className="eyebrow">IN WORLD ENERGY / COLOMBIA</span>
        <span>Valores expresados en pesos colombianos.</span>
        <div>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
        </div>
      </div>
    </footer>
  );
}
