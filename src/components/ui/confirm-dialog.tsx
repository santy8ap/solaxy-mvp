"use client";
import { AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";
import { useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose(): void;
  onConfirm(): void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmTone?: "danger" | "primary";
  warning?: boolean;
}

/**
 * Diálogo de confirmación para acciones destructivas o irreversibles:
 * retirar fondos, cancelar ofertas, ajustar kW de otros usuarios, etc.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmTone = "danger",
  warning = false,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-silicon-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-6 sm:rounded-b-[var(--radius-panel)] sm:p-7 sm:max-w-[440px]"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {warning ? (
              <ShieldAlert size={26} className="text-alert-400" />
            ) : (
              <AlertCircle size={26} className="text-dusk-300" />
            )}
            <h2 className="text-xl font-semibold text-silver-50">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-silver-400 hover:text-silver-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {description && (
          <p className="mb-6 text-sm text-silver-300 leading-relaxed">{description}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-silicon-600/70 bg-silicon-950/40 px-4 py-3 text-sm text-silver-300 hover:bg-silicon-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              confirmTone === "danger"
                ? "border-alert-400/30 bg-alert-400/10 text-alert-400 hover:bg-alert-400/20 hover:text-alert-300"
                : "border-sun-400/30 bg-sun-400/10 text-sun-400 hover:bg-sun-400/20 hover:text-sun-300"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Diálogo de éxito tras una acción completada (se puede reutilizar tras confirmar). */
export function ConfirmResult({
  open,
  onClose,
  title,
  detail,
  icon = CheckCircle,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  detail: string;
  icon?: React.ElementType;
}) {
  const Icon = icon;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-silicon-950/70 p-0 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-6 sm:rounded-b-[var(--radius-panel)] sm:p-7 sm:max-w-[440px]"
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf-400/15 text-leaf-400 mb-4">
            <Icon size={28} />
          </div>
          <h2 className="text-xl font-semibold text-silver-50">{title}</h2>
          <p className="mt-3 text-sm text-silver-300 leading-relaxed">{detail}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full btn btn-sun"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}