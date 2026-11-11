"use client";
import { AlertTriangle, Check } from "lucide-react";
import { useSyncExternalStore } from "react";

type Tone = "ok" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Aviso breve arriba de la pantalla. Los errores duran más: hay que alcanzar a leerlos. */
export function toast(message: string, tone: Tone = "ok") {
  const id = ++seq;
  toasts = [...toasts, { id, message, tone }];
  emit();
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    tone === "error" ? 7000 : 4500,
  );
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-[520px] items-start gap-3 px-4 py-3 text-sm ${t.tone === "error" ? "sheet text-ink" : "bg-ink text-void"}`}
        >
          {t.tone === "error" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
