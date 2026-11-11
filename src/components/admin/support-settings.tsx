"use client";
import { useState } from "react";
import { refetch, useJson } from "@/lib/client/use-json";
import { SupportInput, type SupportSettings } from "@/lib/support-schema";
import { ErrorNote, Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

export function SupportSettingsForm() {
  const { data, error } = useJson<SupportSettings>("/api/support");
  return (
    <section className="mt-16 border-t border-line-strong pt-8">
      <h2 className="text-xl font-medium">Atención al comercializador</h2>
      <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-mute">
        Publica aquí el correo y el número de WhatsApp oficiales. Aparecerán en
        el centro de ayuda y en la asistencia de la compra.
      </p>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      {data ? (
        <ContactForm key={data.updatedAt ?? "nuevo"} initial={data} />
      ) : (
        <div className="skeleton mt-6 h-40" aria-busy="true" />
      )}
    </section>
  );
}

function ContactForm({ initial }: { initial: SupportSettings }) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-7 max-w-[700px] space-y-6"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = SupportInput.safeParse({
          email: email.trim(),
          whatsapp,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Revisa el contacto.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          const response = await fetch("/api/admin/support-settings", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.data),
          });
          const json = await response.json();
          if (!response.ok)
            throw new Error(json.error ?? "No se pudo guardar.");
          await refetch("/api/support");
          toast("Contactos de soporte actualizados.");
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Correo oficial de soporte">
        {(id, aria) => (
          <input
            id={id}
            {...aria}
            className="field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        )}
      </Field>
      <Field
        label="WhatsApp con código de país"
        hint="Solo el número público de atención, con código de país. Deja vacío el canal que no utilices."
      >
        {(id, aria) => (
          <input
            id={id}
            {...aria}
            className="field num"
            type="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            autoComplete="tel"
          />
        )}
      </Field>
      {!initial.email && !initial.whatsapp && (
        <p className="text-sm leading-relaxed text-mute">
          Agrega al menos un contacto oficial para habilitar la atención por
          correo o WhatsApp.
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="submit" className="btn btn-solid" disabled={busy}>
        {busy ? "Guardando…" : "Guardar contactos de soporte"}
      </button>
    </form>
  );
}
