"use client";
import { Eye, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { useAmountPrivacy } from "@/lib/client/use-amount-privacy";

export function PrivacyToggle() {
  const { hidden, toggle } = useAmountPrivacy();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      className="btn btn-ghost privacy-toggle"
      onClick={toggle}
      aria-pressed={hidden}
      title={
        hidden
          ? "Mostrar los importes en esta pantalla"
          : "Ocultar los importes en esta pantalla"
      }
    >
      <Icon size={15} />
      <span>{hidden ? "Mostrar importes" : "Ocultar importes"}</span>
    </button>
  );
}
export function PrivateAmount({ children }: { children: ReactNode }) {
  const { hidden } = useAmountPrivacy();
  return hidden ? (
    <span className="amount-mask">
      <span aria-hidden="true">••••••</span>
      <span className="sr-only">Importe oculto</span>
    </span>
  ) : (
    <>{children}</>
  );
}
export function PrivateChartPlaceholder() {
  return (
    <div className="private-chart">
      <EyeOff size={24} aria-hidden="true" />
      <p>Los importes están ocultos.</p>
      <span>Usa «Mostrar importes» para consultar la gráfica.</span>
    </div>
  );
}
