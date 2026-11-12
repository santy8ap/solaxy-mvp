"use client";
import { Mail, MessageCircle } from "lucide-react";
import { useJson } from "@/lib/client/use-json";
import type { SupportSettings } from "@/lib/support-schema";

export function SupportContacts({ reference }: { reference?: string }) {
  const { data } = useJson<SupportSettings>("/api/support");
  if (!data?.email && !data?.whatsapp) return null;
  const message = `Hola, necesito ayuda con ${reference ? `la operación ${reference}` : "mi plan de energía"}.`;
  return (
    <section
      className="mt-10 border-t border-line pt-7"
      aria-label="Contactos oficiales de soporte"
    >
      <h2 className="text-xl font-medium">Habla con nuestro equipo</h2>
      <p className="mt-3 text-sm leading-relaxed text-fog">
        Ten a mano la referencia de tu operación. Nuestro equipo puede revisar
        el estado contigo.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {data.email && (
          <a
            className="btn btn-ghost"
            href={`mailto:${data.email}?${new URLSearchParams({ subject: reference ? `Ayuda con ${reference}` : "Ayuda con mi plan", body: message })}`}
          >
            <Mail size={16} /> {data.email}
          </a>
        )}
        {data.whatsapp && (
          <a
            className="btn btn-solid"
            href={`https://wa.me/${data.whatsapp}?${new URLSearchParams({ text: message })}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={16} /> WhatsApp de soporte
          </a>
        )}
      </div>
    </section>
  );
}
