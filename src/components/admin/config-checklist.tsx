"use client";
import { AlertTriangle, Check, ChevronDown, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import type { ConfigCheck, ConfigStatus } from "@/lib/admin/config-status";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { ErrorNote, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

/** La misma frase que exige el servidor (lib/admin/demo-reset). */
const RESET_PHRASE = "BORRAR DATOS DE PRUEBA";

/* ───────────── Lista para cobrar de verdad ───────────── */

const STATE_TEXT: Record<ConfigCheck["state"], string> = {
  ok: "Listo",
  falta: "Falta",
  aviso: "Revisar",
  info: "Dato",
};

/** Estado de un punto de la lista, sin color: ✓ listo, ✕ sobre fondo claro si falta, triángulo si hay que revisar. */
function CheckMark({ state }: { state: ConfigCheck["state"] }) {
  const base =
    "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center";
  if (state === "ok") {
    return (
      <span className={`${base} border border-line-strong text-ink`}>
        <Check size={13} strokeWidth={2.2} aria-hidden="true" />
        <span className="sr-only">{STATE_TEXT.ok}</span>
      </span>
    );
  }
  if (state === "falta") {
    return (
      <span className={`${base} bg-ink text-void`}>
        <X size={13} strokeWidth={2.6} aria-hidden="true" />
        <span className="sr-only">{STATE_TEXT.falta}</span>
      </span>
    );
  }
  if (state === "aviso") {
    return (
      <span className={`${base} border border-ink text-ink`}>
        <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{STATE_TEXT.aviso}</span>
      </span>
    );
  }
  return (
    <span className={`${base} border border-dashed border-line-strong`}>
      <span className="h-1 w-1 rounded-full bg-mute" aria-hidden="true" />
      <span className="sr-only">{STATE_TEXT.info}</span>
    </span>
  );
}

function ResetDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<{
        deletedUsers: number;
        deletedTx: number;
        deletedPlans: number;
      }>("/api/admin/demo-data", { confirm: text });
      toast(
        `Listo: se borraron ${r.deletedPlans} planes y ${r.deletedTx} movimientos de prueba.`,
      );
      void refetch("/api/admin/config-status");
      void refetch("/api/admin/overview");
      void refetch("/api/plans");
      setText("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Borrar los datos de prueba"
    >
      <p className="leading-relaxed text-fog">
        Se borran la cuenta de pruebas y todos los planes y movimientos de la
        etapa de pruebas. Las cuentas reales y los datos de los
        comercializadores se conservan, pero quedan sin planes. No se puede
        deshacer.
      </p>
      <form onSubmit={submit} className="mt-7 space-y-6">
        <Field label={`Escribe ${RESET_PHRASE} para confirmar`}>
          {(id, aria) => (
            <input
              id={id}
              {...aria}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="field num"
            />
          )}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-solid"
            disabled={busy || text.trim() !== RESET_PHRASE}
          >
            {busy ? "Borrando…" : "Borrar los datos de prueba"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Lo que falta para cobrar dinero real, con la prueba de las conexiones y el borrado de los datos de prueba. */
export function ConfigChecklist({ className = "mt-14" }: { className?: string }) {
  const [probes, setProbes] = useState(false);
  const url = probes
    ? "/api/admin/config-status?probar=1"
    : "/api/admin/config-status";
  const { data, loading, error } = useJson<ConfigStatus>(url);
  const [open, setOpen] = useState<boolean | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const expanded = open ?? (data ? !data.readyForLive || data.demoMode : false);
  const groups = data ? [...new Set(data.checks.map((c) => c.group))] : [];
  const headline = !data
    ? "Revisando la configuración…"
    : !data.readyForLive
      ? `${data.missing === 1 ? "Falta 1 punto" : `Faltan ${data.missing} puntos`} para cobrar dinero real.`
      : data.demoMode
        ? "Todo está listo. Para cobrar dinero real, pon DEMO_MODE=false en Vercel y vuelve a desplegar."
        : "La página está cobrando dinero real.";

  return (
    <section
      className={`${className} border-t border-line-strong`}
      aria-labelledby="cfg-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5">
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-controls="cfg-list"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <ChevronDown
            size={18}
            strokeWidth={1.5}
            className={`mt-1.5 shrink-0 text-mute transition-transform ${expanded ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
          <span>
            <span id="cfg-title" className="block text-xl font-medium">
              Para cobrar de verdad
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-mute">
              {headline}
            </span>
          </span>
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loading}
          onClick={() => {
            if (probes) void refetch(url);
            setProbes(true);
            setOpen(true);
          }}
        >
          <RefreshCw
            size={14}
            strokeWidth={1.5}
            className={loading ? "animate-spin" : ""}
            aria-hidden="true"
          />{" "}
          Probar las conexiones
        </button>
      </div>
      {error && <ErrorNote className="mb-6">{error}</ErrorNote>}
      {expanded && data && (
        <div
          id="cfg-list"
          className="gap-x-14 border-t border-line md:columns-2"
        >
          {groups.map((g) => (
            <div key={g} className="break-inside-avoid py-6">
              <h3 className="cap">{g}</h3>
              <ul className="mt-3">
                {data.checks
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <li
                      key={c.id}
                      className="flex gap-3.5 border-t border-line py-3.5 first:border-t-0"
                    >
                      <CheckMark state={c.state} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.title}</p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-mute">
                          {c.detail}
                        </p>
                        {c.vars && c.state !== "ok" && (
                          <p className="num mt-1.5 break-words text-xs text-fog">
                            {c.vars.join("  ")}
                          </p>
                        )}
                        {c.action === "borrar_datos_prueba" && (
                          <button
                            type="button"
                            className="link mt-2.5 text-sm"
                            onClick={() => setResetOpen(true)}
                          >
                            Borrar los datos de prueba
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} />
    </section>
  );
}
