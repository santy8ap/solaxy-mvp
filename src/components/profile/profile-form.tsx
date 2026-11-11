"use client";
import Link from "next/link";
import { useState } from "react";
import { refetch, useJson } from "@/lib/client/use-json";
import type { ProfileDTO } from "@/lib/profile";
import { DOC_TYPE_OPTIONS, parseProfile, type DocTypeId, type ProfileField } from "@/lib/profile-schema";
import { Checkbox, ErrorNote, Field } from "@/components/ui/field";

export interface ProfileResponse {
  profile: ProfileDTO | null;
  termsVersion: string;
  email: string;
}

export function useProfile() {
  const { data, error } = useJson<ProfileResponse>("/api/profile");
  return { data: data ?? null, error, loaded: !!data };
}

const DOC_PLACEHOLDER: Record<DocTypeId, string> = { CC: "1036123456", CE: "E123456", PP: "AB123456" };

/** Formulario de los datos de la empresa y aceptación de términos. */
export function ProfileForm({ onSaved, submitLabel = "Guardar los datos" }: { onSaved?(p: ProfileDTO): void; submitLabel?: string }) {
  const { data, error } = useProfile();
  if (!data) {
    return error ? <ErrorNote>{error}</ErrorNote> : <div className="skeleton h-[460px]" aria-busy="true" aria-label="Cargando los datos de la empresa" />;
  }
  // Al guardar cambia la fecha de aceptación y el formulario arranca con lo guardado.
  return <ProfileFields key={data.profile?.termsAcceptedAt ?? "nuevo"} initial={data} onSaved={onSaved} submitLabel={submitLabel} />;
}

function ProfileFields({ initial, onSaved, submitLabel }: { initial: ProfileResponse; onSaved?(p: ProfileDTO): void; submitLabel: string }) {
  const p = initial.profile;
  const [form, setForm] = useState({
    companyName: p?.companyName ?? "",
    nit: p?.nit ?? "",
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
  // Ya tenía datos, pero falta aceptar los términos vigentes (o completar la razón social y el NIT).
  const mustReview = Boolean(p && !p.complete);
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
        setServerError(json.error ?? "No se pudieron guardar los datos.");
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

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {mustReview && <p className="border-l-2 border-ink pl-4 text-sm leading-relaxed text-fog">Completa los datos de la empresa y acepta los Términos y la Política de Datos vigentes para continuar.</p>}

      <fieldset className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <legend className="sr-only">Empresa</legend>
        <Field label="Razón social" error={errors.companyName} className="sm:col-span-2">
          {(id, aria) => <input id={id} {...aria} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} autoComplete="organization" placeholder="Como aparece en el RUT" className="field" />}
        </Field>
        <Field label="NIT" error={errors.nit} hint="Con o sin dígito de verificación.">
          {(id, aria) => <input id={id} {...aria} value={form.nit} onChange={(e) => set("nit", e.target.value)} inputMode="numeric" placeholder="900123456-8" className="field num" />}
        </Field>
        <Field label="Ciudad" error={errors.city}>
          {(id, aria) => <input id={id} {...aria} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" placeholder="Medellín" className="field" />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <legend className="mb-6 text-lg font-medium sm:col-span-2">Representante legal</legend>
        <Field label="Nombre completo" error={errors.fullName} className="sm:col-span-2">
          {(id, aria) => <input id={id} {...aria} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" placeholder="Como aparece en su documento" className="field" />}
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
          {(id, aria) => <input id={id} {...aria} value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} inputMode={form.docType === "CC" ? "numeric" : "text"} placeholder={DOC_PLACEHOLDER[form.docType]} className="field num" />}
        </Field>
        <Field label="Celular" error={errors.phone}>
          {(id, aria) => <input id={id} {...aria} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel-national" inputMode="tel" placeholder="300 123 4567" className="field num" />}
        </Field>
      </fieldset>

      <div>
        <Checkbox checked={form.acceptTerms} onChange={(v) => set("acceptTerms", v)} invalid={!!errors.acceptTerms} describedBy={errors.acceptTerms ? "terms-error" : undefined}>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className="link text-ink">
            Términos y Condiciones
          </Link>{" "}
          y autorizo el tratamiento de los datos según la{" "}
          <Link href="/privacidad" target="_blank" className="link text-ink">
            Política de Tratamiento de Datos
          </Link>{" "}
          (Ley 1581 de 2012).
        </Checkbox>
        {errors.acceptTerms && (
          <p id="terms-error" className="mt-2 text-sm text-ink">
            {errors.acceptTerms}
          </p>
        )}
      </div>

      {serverError && <ErrorNote>{serverError}</ErrorNote>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-mute">Cuenta: {initial.email}</p>
        <button type="submit" disabled={busy} className="btn btn-solid">
          {busy ? "Guardando…" : saved ? "Datos guardados" : submitLabel}
        </button>
      </div>
    </form>
  );
}
