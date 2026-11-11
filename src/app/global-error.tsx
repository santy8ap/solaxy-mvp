"use client";
import { useEffect } from "react";

/**
 * Error en el layout raíz. Reemplaza todo el documento y no recibe los estilos globales,
 * por eso lleva los suyos en línea.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="es-CO">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", background: "#050505", color: "#f2f2f0", fontFamily: "system-ui, sans-serif" }}>
        <title>Algo salió mal</title>
        <main style={{ padding: "2rem 1.5rem", maxWidth: "36rem", margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 300, lineHeight: 1, textTransform: "uppercase" }}>Algo salió mal</h1>
          <p style={{ marginTop: "1.25rem", lineHeight: 1.6, color: "#b9b9b5" }}>No pudimos cargar la página. Tus planes, tu energía y tu saldo no cambian por este error.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: "2rem", padding: "0.9rem 1.4rem", border: 0, background: "#f2f2f0", color: "#050505", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
          >
            Volver a intentar
          </button>
        </main>
      </body>
    </html>
  );
}
