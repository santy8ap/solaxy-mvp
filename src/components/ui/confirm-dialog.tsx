"use client";
import { AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";
import type { ElementType } from "react";
import { Dialog } from "./dialog";

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

/** A consistent, keyboard-accessible confirmation surface for account actions. */
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
  const Icon = warning ? ShieldAlert : AlertCircle;
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <Icon size={26} aria-hidden="true" />
      {description && <p className="table-note">{description}</p>}
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={`btn ${confirmTone === "primary" ? "btn-sun" : "btn-ghost"}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
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
  icon?: ElementType;
}) {
  const Icon = icon;
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="empty-state">
        <Icon size={28} aria-hidden="true" />
        <p>{detail}</p>
        <button type="button" className="btn btn-sun mt-6" onClick={onClose}>
          Listo
        </button>
      </div>
    </Dialog>
  );
}
