"use client";
import { Check, CircleAlert, Info, X } from "lucide-react";
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
const emit = () => listeners.forEach((listener) => listener());
function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}
export function toast(message: string, tone: Tone = "ok") {
  const id = ++seq;
  toasts = [...toasts, { id, message, tone }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), 6000);
}
const EMPTY: Toast[] = [];
export function Toaster() {
  const list = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="toast-stack" aria-live="polite">
      {list.map((item) => {
        const Icon =
          item.tone === "ok"
            ? Check
            : item.tone === "error"
              ? CircleAlert
              : Info;
        return (
          <div
            key={item.id}
            className={`eclipse-toast ${item.tone === "ok" ? "is-success" : ""}`}
            role={item.tone === "error" ? "alert" : "status"}
          >
            <Icon size={18} aria-hidden="true" />
            <p>{item.message}</p>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(item.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
