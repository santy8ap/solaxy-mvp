"use client";
import { useState } from "react";
import { postJson, useJson } from "@/lib/client/use-json";
import { ErrorNote } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const STATUS_URL = "/api/admin/alerts";

interface AlertStatus {
  enabled: boolean;
  hasKey: boolean;
  to: string[];
}

interface Delivery {
  to: string;
  ok: boolean;
  error?: string;
}

/** Si las alertas por correo están listas, a quién llegan, y un botón para probarlas. */
export function AlertSettings() {
  const { data, error } = useJson<AlertStatus>(STATUS_URL);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Delivery[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const sendTest = async () => {
    setBusy(true);
    setSendError(null);
    setResults(null);
    try {
      const r = await postJson<{ results: Delivery[] }>(STATUS_URL);
      setResults(r.results);
      if (r.results.length && r.results.every((d) => d.ok)) toast("Correo de prueba enviado. Revisa tu bandeja (y la carpeta de spam).");
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-16 border-t border-line-strong pt-8" aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="text-xl font-medium">
        Alertas por correo
      </h2>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-mute">
        Te escribimos cuando entra un pago, cuando una empresa reporta una transferencia, cuando alguien pide un retiro, cuando Mercado Pago devuelve un pago y cuando algo falla en el servidor.
      </p>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      {!data && !error && <div className="skeleton mt-6 h-20" aria-busy="true" aria-label="Cargando el estado de las alertas" />}
      {data && (
        <div className="mt-6 max-w-[68ch] space-y-5">
          <p className="text-sm leading-relaxed text-fog">
            {data.enabled
              ? `Activas. Llegan a ${data.to.join(", ")}.`
              : !data.hasKey
                ? "Apagadas: falta la clave de Resend (RESEND_API_KEY) en Vercel. Agrégala en Production, marcada como Sensitive, y vuelve a desplegar."
                : "Apagadas: no hay a quién enviarlas. Agrega tu correo a ALERT_EMAIL o a ADMIN_EMAILS en Vercel."}
          </p>
          {data.enabled && (
            <button type="button" className="btn btn-ghost" onClick={() => void sendTest()} disabled={busy}>
              {busy ? "Enviando…" : "Enviar correo de prueba"}
            </button>
          )}
          {sendError && <ErrorNote>{sendError}</ErrorNote>}
          {results && (
            <ul className="space-y-2 text-sm leading-relaxed">
              {results.map((d) => (
                <li key={d.to} className={d.ok ? "text-fog" : "text-ink"}>
                  {d.ok ? `Enviado a ${d.to}.` : `No se pudo enviar a ${d.to}: ${d.error ?? "error desconocido"}.`}
                  {!d.ok && /own email|testing emails/i.test(d.error ?? "") && " Sin dominio propio, Resend solo entrega al correo con que creaste la cuenta: pon ese correo en ALERT_EMAIL."}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
