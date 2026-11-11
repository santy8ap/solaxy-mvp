"use client";
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

export function toast(message: string, tone: Tone = "ok") {
  const id = ++seq;
  toasts = [...toasts, { id, message, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4800);
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
          className={`pointer-events-auto max-w-[480px] rounded-none border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
            t.tone === "error"
              ? "border-alert-400/50 bg-silicon-950/95 text-alert-400"
              : t.tone === "info"
                ? "border-silicon-500 bg-silicon-950/95 text-silver-100"
                : "border-leaf-400/50 bg-silicon-950/95 text-leaf-300"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
