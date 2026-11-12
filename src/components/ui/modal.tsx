"use client";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal. En celular sube desde abajo y ocupa el ancho; en escritorio va centrado.
 * Atrapa el foco, se cierra con Escape y devuelve el foco a donde estaba.
 */
export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose(): void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const box = ref.current;
    box?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim/80 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`sheet max-h-[92dvh] w-full overflow-y-auto p-6 sm:p-8 ${wide ? "sm:max-w-[600px]" : "sm:max-w-[460px]"}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="display text-[2rem]">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 p-2 text-mute hover:text-ink" aria-label="Cerrar">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
