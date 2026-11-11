"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Error inesperado en cualquier página: se puede reintentar sin perder la sesión. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col justify-center px-5 py-16 sm:px-8">
      <h1 className="display text-[clamp(2.75rem,7vw,5rem)]">Algo salió mal</h1>
      <p className="mt-5 max-w-[48ch] leading-relaxed text-fog">No pudimos mostrar esta página. Tus planes, tu energía y tu saldo no cambian por este error.</p>
      <div className="mt-9 flex flex-wrap gap-3">
        <button type="button" className="btn btn-solid" onClick={() => retry()}>
          Volver a intentar
        </button>
        <Link href="/" className="btn btn-ghost">
          Ir al inicio
        </Link>
      </div>
      {digest && <p className="num mt-10 text-xs text-dim">Código del error: {digest}</p>}
    </main>
  );
}
