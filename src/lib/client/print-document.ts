"use client";
/** Print from a same-origin document without navigating away or opening a popup. */
export function printDocument(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = title;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;inset:auto 0 0 auto;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    const cleanup = () => frame.remove();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(
        new Error("No se pudo preparar el documento. Inténtalo de nuevo."),
      );
    }, 15000);
    frame.onload = () => {
      window.clearTimeout(timeout);
      const target = frame.contentWindow;
      if (!target || typeof target.print !== "function") {
        cleanup();
        reject(new Error("La impresión no está disponible en este navegador."));
        return;
      }
      target.addEventListener("afterprint", cleanup, { once: true });
      try {
        target.focus();
        target.print();
        resolve();
      } catch {
        cleanup();
        reject(
          new Error(
            "No se pudo abrir la impresión. Puedes descargar el documento.",
          ),
        );
      }
      window.setTimeout(cleanup, 60000);
    };
    frame.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("No se pudo cargar el documento."));
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
export function downloadFile(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
