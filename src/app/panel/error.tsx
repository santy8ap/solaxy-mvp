"use client";
import Link from "next/link";
import { ArrowUpRight, RotateCcw } from "lucide-react";

export default function PanelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  return (
    <section className="workspace-error" role="alert">
      <span className="eyebrow">IN WORLD ENERGY / TU CUENTA</span>
      <RotateCcw size={36} aria-hidden="true" />
      <h1>
        HAGAMOS
        <br />
        OTRO INTENTO.
      </h1>
      <p>
        No pudimos cargar esta parte de tu cuenta. Vuelve a intentarlo o regresa
        al inicio.
      </p>
      <div className="route-state-actions">
        <button type="button" className="btn btn-sun" onClick={reset}>
          Volver a intentar
        </button>
        <Link href="/" className="btn btn-ghost">
          Ir al inicio <ArrowUpRight size={15} />
        </Link>
      </div>
    </section>
  );
}
