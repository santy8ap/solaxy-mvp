"use client";
import { useId } from "react";

/** Un campo con su rótulo y su error. `children` recibe el id y los atributos de accesibilidad. */
export function Field({
  label,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children(id: string, aria: { "aria-invalid": boolean; "aria-describedby"?: string }): React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="cap block">
        {label}
      </label>
      {children(id, { "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Mensaje de error de un formulario o de una acción. */
export function ErrorNote({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={`border-l-2 border-ink pl-4 text-sm leading-relaxed text-ink ${className}`}>
      {children}
    </p>
  );
}

/** Casilla de verificación cuadrada, sin color. */
export function Checkbox({ checked, onChange, children, invalid, describedBy }: { checked: boolean; onChange(v: boolean): void; children: React.ReactNode; invalid?: boolean; describedBy?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fog">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" aria-invalid={invalid} aria-describedby={describedBy} />
      <span aria-hidden="true" className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border border-line-strong text-void transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
        {checked && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4.5l3 3 6-6.5" />
          </svg>
        )}
      </span>
      <span>{children}</span>
    </label>
  );
}
