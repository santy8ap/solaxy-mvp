"use client";
import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatDate } from "@/lib/format";
import { ErrorNote, Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const URL_REQUEST = "/api/profile/deletion";

interface DeletionRequest {
  id: string;
  status: "pendiente" | "atendida" | "respondida";
  reason: string | null;
  createdAt: number;
  dueAt: number;
  resolvedAt: number | null;
  resolution: string | null;
}

/** Derechos sobre los datos personales (Ley 1581 de 2012): descargarlos y pedir que se elimine la cuenta. */
export function DataRights() {
  const { data } = useJson<{ request: DeletionRequest | null }>(URL_REQUEST);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = data?.request ?? null;
  const pending = request?.status === "pendiente";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(URL_REQUEST, { reason: reason.trim() || undefined });
      await refetch(URL_REQUEST);
      toast("Recibimos tu solicitud.");
      setAsking(false);
      setReason("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-16 border-t border-line-strong pt-8" aria-labelledby="data-rights-title">
      <h2 id="data-rights-title" className="text-xl font-medium">
        Tus datos personales
      </h2>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-mute">
        Puedes descargar todo lo que guardamos de tu cuenta y pedir que la eliminemos, como lo dice la{" "}
        <Link href="/privacidad" className="link">
          Política de Tratamiento de Datos
        </Link>
        .
      </p>

      <div className="mt-7 grid gap-x-16 gap-y-10 lg:grid-cols-2">
        <div>
          <h3 className="font-medium">Descargar mis datos</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mute">Tu cuenta, tus datos personales, tus planes y todos tus movimientos, en un archivo.</p>
          <a href="/api/profile/data" download className="btn btn-ghost mt-4 inline-flex items-center gap-2">
            <Download size={14} aria-hidden="true" /> Descargar mis datos
          </a>
        </div>

        <div>
          <h3 className="font-medium">Eliminar mi cuenta</h3>
          {pending ? (
            <p className="mt-1.5 text-sm leading-relaxed text-fog">
              Pediste eliminar tu cuenta el {formatDate(request.createdAt)}. Te responderemos a más tardar el {formatDate(request.dueAt)}.
            </p>
          ) : (
            <>
              {request?.status === "respondida" && request.resolution && (
                <p className="mt-1.5 text-sm leading-relaxed text-fog">
                  Respuesta a tu solicitud del {formatDate(request.createdAt)}: {request.resolution}
                </p>
              )}
              <p className="mt-1.5 text-sm leading-relaxed text-mute">
                Eliminamos tu acceso y tus datos de contacto. Si pagaste algún mes, conservamos tu nombre, tu documento y tus movimientos, porque la ley contable nos obliga a guardarlos. Si tienes un plan vigente o saldo, primero hay que cerrarlo o retirarlo.
              </p>
              {!asking ? (
                <button type="button" className="btn btn-ghost mt-4" onClick={() => setAsking(true)}>
                  Pedir que eliminen mi cuenta
                </button>
              ) : (
                <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-5">
                  <Field label="Motivo (opcional)">
                    {(id, aria) => <textarea id={id} {...aria} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className="field" />}
                  </Field>
                  {error && <ErrorNote>{error}</ErrorNote>}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)} disabled={busy}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-solid" disabled={busy}>
                      {busy ? "Enviando…" : "Enviar la solicitud"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
