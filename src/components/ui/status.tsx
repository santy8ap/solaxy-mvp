import { AlertTriangle, Check, X } from "lucide-react";

export type StatusTone = "ok" | "wait" | "off" | "act";

/**
 * Estado sin color: ✓ confirmado, anillo punteado en proceso, tachado si no ocurrió,
 * y relleno invertido cuando alguien tiene que hacer algo.
 */
export function Status({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className="status" data-tone={tone}>
      {tone === "ok" && <Check size={12} strokeWidth={2.4} aria-hidden="true" />}
      {tone === "wait" && <span className="h-2.5 w-2.5 rounded-full border border-dashed border-current" aria-hidden="true" />}
      {tone === "off" && <X size={12} strokeWidth={2.2} aria-hidden="true" />}
      {tone === "act" && <AlertTriangle size={12} strokeWidth={2.2} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Cómo se muestra el estado de un movimiento (pago o retiro). */
export const TX_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pendiente: { label: "Sin pagar", tone: "wait" },
  verificando: { label: "Verificando", tone: "wait" },
  por_aprobar: { label: "En revisión", tone: "wait" },
  confirmada: { label: "Confirmado", tone: "ok" },
  rechazada: { label: "Rechazado", tone: "off" },
  fallida: { label: "No aprobado", tone: "off" },
  cancelada: { label: "Cancelado", tone: "off" },
  por_reembolsar: { label: "Por reembolsar", tone: "act" },
  reembolsada: { label: "Reembolsado", tone: "ok" },
};

/** Cómo se muestra el estado de un plan. */
export const PLAN_STATE: Record<string, { label: string; tone: StatusTone }> = {
  activa: { label: "Generando", tone: "ok" },
  en_pausa: { label: "En pausa", tone: "act" },
  completada: { label: "Completado", tone: "ok" },
  vencida: { label: "Cerrado", tone: "off" },
  cancelada: { label: "Cerrado", tone: "off" },
  borrador: { label: "Sin pagar", tone: "wait" },
};
