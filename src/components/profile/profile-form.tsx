"use client";
import { Check } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { refetch, useJson } from "@/lib/client/use-json";
import type { ProfileDTO } from "@/lib/profile";
import { DOC_TYPE_OPTIONS, parseProfile, type DocTypeId, type ProfileField } from "@/lib/profile-schema";

export interface ProfileResponse {
  profile: ProfileDTO | null;
  termsVersion: string;
  email: string;
}

export function useProfile() {
  const { data, error } = useJson<ProfileResponse>("/api/profile");
  return { data: data ?? null, error, loaded: !!data };
}

const PLACEHOLDER: Record<DocTypeId, string> = { CC: "1036123456", CE: "E123456", PP: "AB123456", NIT: "900123456-8" };

/** Formulario de datos del inversionista y aceptación de términos. */
export function ProfileForm({ onSaved, submitLabel = "Guardar mis datos" }: { onSaved?(p: ProfileDTO): void; submitLabel?: string }) {
  const { data, error } = useProfile();
  if (!data) {
    return error ? (
      <p role="alert" className="text-sm text-alert-400">
        {error}
      </p>
    ) : (
      <div className="h-[420px] animate-pulse rounded-none bg-silicon-800/60" aria-busy="true" aria-label="Cargando tus datos" />
    );
  }
  // Al guardar cambia la fecha de aceptación y el formulario arranca con lo guardado.
  return <ProfileFields key={data.profile?.termsAcceptedAt ?? "nuevo"} initial={data} onSaved={onSaved} submitLabel={submitLabel} />;
}

function ProfileFields({ initial, onSaved, submitLabel }: { initial: ProfileResponse; onSaved?(p: ProfileDTO): void; submitLabel: string }) {
  const p = initial.profile;
  const [form, setForm] = useState({
    fullName: p?.fullName ?? "",
    docType: (p?.docType ?? "CC") as DocTypeId,
    docNumber: p?.docNumber ?? "",
    phone: p?.phone ?? "",
    city: p?.city ?? "",
    acceptTerms: Boolean(p?.complete),
  });
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const termsChanged = Boolean(p && !p.complete);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setSaved(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseProfile(form);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = (await res.json().catch(() => ({}))) as { profile?: ProfileDTO; error?: string; fields?: typeof errors };
      if (!res.ok || !json.profile) {
        if (json.fields) setErrors(json.fields);
        setServerError(json.error ?? "No se pudieron guardar tus datos.");
        return;
      }
      setSaved(true);
      onSaved?.(json.profile);
      void refetch("/api/profile");
    } catch {
      setServerError("No se pudo conectar. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const isCompany = form.docType === "NIT";
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {termsChanged && (
        <p className="rounded-none border border-sun-400/40 bg-sun-400/10 p-3 text-sm text-sun-200">
          Actualizamos los Términos y la Política de Datos. Revísalos y acéptalos para seguir comprando.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={isCompany ? "Razón social" : "Nombre completo"} error={errors.fullName} className="sm:col-span-2">
          {(id, aria) => (
            <input id={id} {...aria} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete={isCompany ? "organization" : "name"} placeholder={isCompany ? "Energía Andina S.A.S." : "Como aparece en tu documento"} className="field" />
          )}
        </Field>
        <Field label="Tipo de documento" error={errors.docType}>
          {(id, aria) => (
            <select id={id} {...aria} value={form.docType} onChange={(e) => set("docType", e.target.value as DocTypeId)} className="field">
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Número de documento" error={errors.docNumber}>
          {(id, aria) => (
            <input id={id} {...aria} value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} inputMode={form.docType === "CC" ? "numeric" : "text"} placeholder={PLACEHOLDER[form.docType]} className="field num" />
          )}
        </Field>
        <Field label="Celular" error={errors.phone}>
          {(id, aria) => (
            <input id={id} {...aria} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel-national" inputMode="tel" placeholder="300 123 4567" className="field num" />
          )}
        </Field>
        <Field label="Ciudad" error={errors.city}>
          {(id, aria) => (
            <input id={id} {...aria} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" placeholder="Medellín" className="field" />
          )}
        </Field>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-none border border-silicon-600/70 p-4 text-sm leading-relaxed text-silver-300 hover:border-silicon-500">
          <input type="checkbox" checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} className="peer sr-only" aria-invalid={!!errors.acceptTerms} aria-describedby={errors.acceptTerms ? "terms-error" : undefined} />
          <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-silicon-500 text-silicon-950 transition-colors peer-checked:border-sun-400 peer-checked:bg-sun-400 peer-focus-visible:ring-2 peer-focus-visible:ring-sun-300">
            {form.acceptTerms && <Check size={14} strokeWidth={3} />}
          </span>
          <span>
            Acepto los{" "}
            <Link href="/terminos" target="_blank" className="text-sun-300 underline underline-offset-2">
              Términos y Condiciones
            </Link>{" "}
            y autorizo el tratamiento de mis datos personales según la{" "}
            <Link href="/privacidad" target="_blank" className="text-sun-300 underline underline-offset-2">
              Política de Tratamiento de Datos
            </Link>{" "}
            (Ley 1581 de 2012).
          </span>
        </label>
        {errors.acceptTerms && (
          <p id="terms-error" className="mt-1.5 text-xs text-alert-400">
            {errors.acceptTerms}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="rounded-none border border-alert-400/40 bg-alert-400/10 p-3 text-sm text-alert-400">
          {serverError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-silver-500">Cuenta: {initial.email}</p>
        <button type="submit" disabled={busy} className="btn btn-sun">
          {busy ? "Guardando…" : saved ? "Datos guardados" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children(id: string, aria: { "aria-invalid": boolean; "aria-describedby"?: string }): React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm text-silver-300">
        {label}
      </label>
      <div className="mt-2">{children(id, { "aria-invalid": !!error, "aria-describedby": error ? `${id}-error` : undefined })}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-alert-400">
          {error}
        </p>
      )}
    </div>
  );
}
