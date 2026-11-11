"use client";
import { AlertTriangle, Check, ChevronDown, ExternalLink, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import type { ConfigCheck, ConfigStatus } from "@/lib/admin/config-status";
import type { AdminPaymentRow, PaymentFilter } from "@/lib/admin/payments";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatAsset, formatCop, formatDateTime, formatNumber } from "@/lib/format";
import { explorerTxUrl, paymentMethodLabel } from "@/components/panel/tx-meta";
import { ErrorNote, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Status, TX_STATUS } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";

/** La misma frase que exige el servidor (lib/admin/demo-reset). */
const RESET_PHRASE = "BORRAR DATOS DE PRUEBA";

const FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "en_proceso", label: "En proceso" },
  { id: "confirmadas", label: "Confirmados" },
  { id: "fallidas", label: "No aprobados" },
  { id: "por_reembolsar", label: "Reembolsos" },
];

type MethodFilter = "todos" | "mercadopago" | "crypto" | "manual" | "demo";

interface PaymentsResponse {
  payments: AdminPaymentRow[];
  summary: { totalCop: number; todayCop: number; inProgress: number; toRefund: number };
}

/* ───────────── Lista para cobrar de verdad ───────────── */

const STATE_TEXT: Record<ConfigCheck["state"], string> = { ok: "Listo", falta: "Falta", aviso: "Revisar", info: "Dato" };

/** Estado de un punto de la lista, sin color: ✓ listo, ✕ sobre fondo claro si falta, triángulo si hay que revisar. */
function CheckMark({ state }: { state: ConfigCheck["state"] }) {
  const base = "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center";
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
      const r = await postJson<{ deletedUsers: number; deletedTx: number; deletedPlans: number }>("/api/admin/demo-data", { confirm: text });
      toast(`Listo: se borraron ${r.deletedPlans} planes y ${r.deletedTx} movimientos de prueba.`);
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
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Borrar los datos de prueba">
      <p className="leading-relaxed text-fog">
        Se borran la cuenta de pruebas y todos los planes y movimientos de la etapa de pruebas. Las cuentas reales y los datos de sus empresas se conservan, pero quedan sin planes. No se puede deshacer.
      </p>
      <form onSubmit={submit} className="mt-7 space-y-6">
        <Field label={`Escribe ${RESET_PHRASE} para confirmar`}>
          {(id, aria) => <input id={id} {...aria} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" className="field num" />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-solid" disabled={busy || text.trim() !== RESET_PHRASE}>
            {busy ? "Borrando…" : "Borrar los datos de prueba"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfigChecklist() {
  const [probes, setProbes] = useState(false);
  const url = probes ? "/api/admin/config-status?probar=1" : "/api/admin/config-status";
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
    <section className="mt-14 border-t border-line-strong" aria-labelledby="cfg-title">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5">
        <button type="button" onClick={() => setOpen(!expanded)} aria-expanded={expanded} aria-controls="cfg-list" className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ChevronDown size={18} strokeWidth={1.5} className={`mt-1.5 shrink-0 text-mute transition-transform ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
          <span>
            <span id="cfg-title" className="block text-xl font-medium">
              Para cobrar de verdad
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-mute">{headline}</span>
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
          <RefreshCw size={14} strokeWidth={1.5} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Probar las conexiones
        </button>
      </div>
      {error && <ErrorNote className="mb-6">{error}</ErrorNote>}
      {expanded && data && (
        <div id="cfg-list" className="gap-x-14 border-t border-line md:columns-2">
          {groups.map((g) => (
            <div key={g} className="break-inside-avoid py-6">
              <h3 className="cap">{g}</h3>
              <ul className="mt-3">
                {data.checks
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <li key={c.id} className="flex gap-3.5 border-t border-line py-3.5 first:border-t-0">
                      <CheckMark state={c.state} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.title}</p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-mute">{c.detail}</p>
                        {c.vars && c.state !== "ok" && <p className="num mt-1.5 break-words text-xs text-fog">{c.vars.join("  ")}</p>}
                        {c.action === "borrar_datos_prueba" && (
                          <button type="button" className="link mt-2.5 text-sm" onClick={() => setResetOpen(true)}>
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

/* ───────────── Pagos ───────────── */

function PaymentActions({ p, listUrl }: { p: AdminPaymentRow; listUrl: string }) {
  const [mode, setMode] = useState<null | "hash" | "reembolso">(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      const r = await postJson<AdminPaymentRow>(`/api/admin/payments/${p.id}`, body);
      toast(`${done}: ${(TX_STATUS[r.status]?.label ?? r.status).toLowerCase()}.`);
      setMode(null);
      setValue("");
      void refetch(listUrl);
      void refetch("/api/admin/overview");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  // Mercado Pago se consulta por la referencia de la orden: sirve aunque la empresa no haya vuelto del pago.
  const canReverify = (p.method === "mercadopago" && (p.status === "pendiente" || p.status === "fallida")) || (p.method === "crypto" && p.status === "verificando");
  const canAttach = p.method === "crypto" && p.status === "pendiente" && !p.providerId;
  const canRefund = p.status === "por_reembolsar";
  const explorer = p.method === "crypto" ? explorerTxUrl(p) : null;
  if (!canReverify && !canAttach && !canRefund && !explorer) return null;
  const validHash = /^0x[0-9a-fA-F]{64}$/.test(value.trim());

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {canReverify && (
          <button type="button" className="link inline-flex items-center gap-1.5" disabled={busy} onClick={() => void run({ action: "reverificar" }, "Consultado")}>
            <RefreshCw size={13} strokeWidth={1.5} className={busy ? "animate-spin" : ""} aria-hidden="true" /> Volver a verificar
          </button>
        )}
        {canAttach && (
          <button type="button" className="link" aria-expanded={mode === "hash"} onClick={() => setMode(mode === "hash" ? null : "hash")}>
            Registrar el hash
          </button>
        )}
        {canRefund && (
          <button type="button" className="link" aria-expanded={mode === "reembolso"} onClick={() => setMode(mode === "reembolso" ? null : "reembolso")}>
            Marcar como reembolsado
          </button>
        )}
        {explorer && (
          <a href={explorer} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1.5">
            Ver en BscScan <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
      {mode && (
        <form
          className="mt-3 flex max-w-[560px] flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void (mode === "hash" ? run({ action: "registrar_hash", txHash: value.trim() }, "Hash registrado") : run({ action: "reembolsado", reference: value.trim() }, "Reembolso registrado"));
          }}
        >
          <Field label={mode === "hash" ? "Hash de la transacción (0x…)" : "Referencia del reembolso"} className="min-w-[220px] flex-1">
            {(id, aria) => <input id={id} {...aria} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" className="field num" />}
          </Field>
          <button type="submit" className="btn btn-solid" disabled={busy || (mode === "hash" ? !validHash : value.trim().length < 4)}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </form>
      )}
    </div>
  );
}

function PaymentRow({ p, listUrl }: { p: AdminPaymentRow; listUrl: string }) {
  const st = TX_STATUS[p.status] ?? TX_STATUS.pendiente;
  const what = [p.planName, p.periodIndex ? `mes ${p.periodIndex}` : null, p.kwh ? `${formatNumber(p.kwh)} kWh` : null].filter(Boolean).join(", ");
  // Lo que respondió la pasarela o la red. En un pago de prueba o registrado a mano no agrega nada.
  const provider = !p.providerStatus ? null : p.method === "mercadopago" ? `Estado en Mercado Pago: ${p.providerStatus}` : p.method === "crypto" ? `En la red: ${p.providerStatus}` : null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-2 border-b border-line py-5 lg:grid-cols-[9.5rem_minmax(0,1fr)_auto] lg:items-baseline">
      <p className="num text-sm text-mute">{formatDateTime(p.createdAt)}</p>
      <div className="min-w-0">
        <p className="font-medium">{p.companyName || p.userName}</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-mute">
          {what ? `${what}. ` : ""}
          {paymentMethodLabel(p)}
          {p.method === "crypto" && p.assetAmount != null && p.asset ? `, ${formatAsset(p.assetAmount, p.asset)}` : ""}
          {provider ? `. ${provider}` : ""}
        </p>
        {p.note && <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-fog">{p.note}</p>}
        <p className="num mt-1 break-all text-xs text-dim">
          {p.id}
          {p.providerId ? ` · ${p.providerId}` : ""}
          {p.userEmail ? ` · ${p.userEmail}` : ""}
        </p>
        <PaymentActions p={p} listUrl={listUrl} />
      </div>
      <div className="flex items-baseline justify-between gap-6 lg:block lg:text-right">
        <p className={`num text-lg ${st.tone === "off" ? "text-dim line-through" : ""}`}>{formatCop(p.amountCop)}</p>
        <p className="lg:mt-2">
          <Status tone={st.tone}>{st.label}</Status>
        </p>
      </div>
    </li>
  );
}

export function AdminPayments() {
  const [filter, setFilter] = useState<PaymentFilter>("todos");
  const [method, setMethod] = useState<MethodFilter>("todos");
  const url = `/api/admin/payments?estado=${filter}&metodo=${method}`;
  const { data, loading, error } = useJson<PaymentsResponse>(url, { refreshMs: 10_000 });
  const { config } = useAppConfig();
  const s = data?.summary;
  const payments = data?.payments ?? [];

  return (
    <>
      <AdminTopbar title="Pagos" subtitle="Las mensualidades que pagan las empresas: su estado, su verificación y los reembolsos." />

      <dl className="grid border-t border-line-strong sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recaudado hoy", value: s ? formatCop(s.todayCop) : "—" },
          { label: "Recaudado en total", value: s ? formatCop(s.totalCop) : "—" },
          { label: "En proceso", value: s ? String(s.inProgress) : "—" },
          { label: "Por reembolsar", value: s ? String(s.toRefund) : "—", alert: !!s && s.toRefund > 0 },
        ].map((t) => (
          <div key={t.label} className="border-b border-line py-5 pr-6">
            <dt className="cap">{t.label}</dt>
            <dd className={`num mt-2 text-[1.5rem] leading-tight ${t.alert ? "inline-block bg-ink px-2 text-void" : ""}`}>{t.value}</dd>
          </div>
        ))}
      </dl>
      {config && (
        <p className="mt-3 text-sm text-mute">
          {config.demoMode ? "En modo de pruebas el recaudo incluye los pagos de prueba." : "El recaudo solo cuenta dinero real: un pago de prueba que quede en la lista no suma."}
        </p>
      )}

      <ConfigChecklist />

      <section className="mt-14" aria-labelledby="pay-title">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-strong pb-4">
          <h2 id="pay-title" className="text-xl font-medium">
            Pagos recibidos
          </h2>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Filtrar por estado">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`border-b pb-1 text-sm transition-colors ${filter === f.id ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="pay-method" className="sr-only">
                Filtrar por medio de pago
              </label>
              <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as MethodFilter)} className="field !w-auto !py-1.5 text-sm">
                <option value="todos">Todos los medios</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="crypto">Cripto</option>
                <option value="manual">Transferencia registrada</option>
                <option value="demo">Pago de prueba</option>
              </select>
            </div>
          </div>
        </div>
        {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
        <ul>
          {payments.map((p) => (
            <PaymentRow key={p.id} p={p} listUrl={url} />
          ))}
        </ul>
        {!loading && !error && payments.length === 0 && <p className="py-10 text-mute">No hay pagos en esta lista. Aparecen aquí apenas una empresa empieza a pagar.</p>}
        {loading && !data && <div className="skeleton mt-6 h-40" aria-busy="true" aria-label="Cargando los pagos" />}
      </section>
    </>
  );
}
