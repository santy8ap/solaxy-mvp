import { Check } from "lucide-react";

const STEPS = ["Datos personales", "Resumen", "Pago", "Confirmación"];

export function CheckoutProgress({ current }: { current: number }) {
  return (
    <nav
      aria-label="Progreso de la compra"
      className="border-y border-line py-5"
    >
      <ol className="grid grid-cols-4 gap-2 sm:gap-6">
        {STEPS.map((label, index) => {
          const step = index + 1;
          return (
            <li
              key={label}
              aria-current={step === current ? "step" : undefined}
              className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center ${step === current ? "text-ink" : "text-mute"}`}
            >
              <span
                className={`num flex h-7 w-7 shrink-0 items-center justify-center border text-xs ${step < current ? "border-ink bg-ink text-void" : step === current ? "border-ink" : "border-line-strong"}`}
                aria-hidden="true"
              >
                {step < current ? <Check size={14} /> : `0${step}`}
              </span>
              <span className="break-words text-[0.7rem] leading-snug sm:text-sm">
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
