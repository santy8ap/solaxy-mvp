import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="route-state">
      <Link href="/" aria-label="In World Energy, inicio">
        <Logo />
      </Link>
      <div className="route-state-content">
        <span className="eyebrow">404 / FUERA DE LA RUTA</span>
        <p className="route-state-code" aria-hidden="true">
          404
        </p>
        <h1>
          BUSQUEMOS
          <br />
          OTRO CAMINO.
        </h1>
        <p>
          La página que buscas no está disponible. Puedes volver al inicio o
          explorar los planes de energía.
        </p>
        <div className="route-state-actions">
          <Link href="/" className="btn btn-sun">
            Volver al inicio <ArrowUpRight size={16} />
          </Link>
          <Link href="/planes" className="btn btn-ghost">
            Explorar planes
          </Link>
        </div>
      </div>
      <span className="eyebrow">IN WORLD ENERGY · COLOMBIA</span>
    </main>
  );
}
