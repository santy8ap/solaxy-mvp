"use client";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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
  const [target, setTarget] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    const locate = () => {
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      setTarget(dialogs.length ? dialogs[dialogs.length - 1] : null);
    };
    locate();
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            (record.type === "attributes" &&
              record.target instanceof HTMLDialogElement) ||
            (record.type === "childList" &&
              [...record.addedNodes, ...record.removedNodes].some(
                (node) =>
                  node instanceof Element &&
                  (node.matches("dialog") || node.querySelector("dialog")),
              )),
        )
      )
        locate();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, []);
  const list = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => toasts,
    () => EMPTY,
  );
  const content = (
    <div
      className={`toast-stack ${target ? "in-dialog" : ""}`}
      aria-live="polite"
    >
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
  return target ? createPortal(content, target) : content;
}
