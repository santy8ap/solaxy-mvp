"use client";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Info, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import type { AdminPaymentRow, PaymentFilter } from "@/lib/admin/payments";
import type { ConfigCheck, ConfigStatus } from "@/lib/admin/config-status";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatAsset, formatCop, formatDateTime, formatKw } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/wallet/connect-dialog";
import { AdminTopbar } from "./shell";

const RESET_PHRASE = "BORRAR DATOS DEMO";

const FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "en_proceso", label: "En proceso" },
  { id: "confirmadas", label: "Confirmados" },
  { id: "fallidas", label: "Fallidos" },
  { id: "por_reembolsar", label: "Reembolsos" },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  pendiente: { label: "Pendiente", tone: "bg-silicon-600/60 text-silver-300" },
  verificando: { label: "Verificando", tone: "bg-sun-400/12 text-sun-300" },
  confirmada: { label: "Confirmado", tone: "bg-leaf-400/12 text-leaf-300" },
  fallida: { label: "Fallido", tone: "bg-alert-400/12 text-alert-400" },
  cancelada: { label: "Cancelado", tone: "bg-silicon-600/60 text-silver-400" },
  por_reembolsar: { label: "Por reembolsar", tone: "bg-alert-400/15 text-alert-400" },
  reembolsada: { label: "Reembolsado", tone: "bg-dusk-400/15 text-dusk-300" },
};

const STATE_ICON: Record<ConfigCheck["state"], React.ReactNode> = {
  ok: <CheckCircle2 size={18} className="text-leaf-300" />,
  falta: <XCircle size={18} className="text-alert-400" />,
  aviso: <AlertTriangle size={18} className="text-sun-300" />,
  info: <Info size={18} className="text-dusk-300" />,
};

function Tile({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`panel p-5 ${alert ? "border-alert-400/50" : ""}`}>
      <div className="text-sm text-silver-400">{label}</div>
      <div className={`num mt-1.5 text-xl font-semibold sm:text-2xl ${alert ? "text-alert-400" : "text-silver-50"}`}>{value}</div>
    </div>
  );
}

function ResetDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await postJson<{ deletedUsers: number; deletedTx: number }>("/api/admin/demo-data", { confirm: text });
      toast(`Listo: se borraron ${r.deletedUsers} usuarios ficticios y ${r.deletedTx} movimientos de la demo.`);
      void refetch("/api/admin/config-status");
      void refetch("/api/admin/overview");
      setText("");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Borrar los datos de demostración">
      <p className="text-sm leading-relaxed text-silver-300">
        Se borran los inversionistas ficticios, la cuenta demo y todos los movimientos, posiciones y ofertas de la etapa de demostración. Las
        cuentas reales y sus datos se conservan, pero quedan sin kW. No se puede deshacer.
      </p>
      <label htmlFor="reset-phrase" className="mt-5 block text-sm text-silver-300">
        Escribe <span className="font-mono text-alert-400">{RESET_PHRASE}</span> para confirmar
      </label>
      <input id="reset-phrase" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" className="field mt-2 font-mono" />
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn bg-alert-400 text-silicon-950 hover:bg-alert-400/90" disabled={busy || text.trim() !== RESET_PHRASE} onClick={() => void run()}>
          <Trash2 size={16} /> {busy ? "Borrando…" : "Borrar datos demo"}
        </button>
      </div>
    </Modal>
  );
}

function ConfigChecklist() {
  const [probes, setProbes] = useState(false);
  const url = probes ? "/api/admin/config-status?probar=1" : "/api/admin/config-status";
  const { data, loading } = useJson<ConfigStatus>(url);
  const [open, setOpen] = useState<boolean | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const expanded = open ?? (data ? !data.readyForLive : true);
  const groups = data ? [...new Set(data.checks.map((c) => c.group))] : [];

  return (
    <section className="panel mt-5 p-5 sm:p-6" aria-labelledby="cfg-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen(!expanded)} className="flex items-center gap-3 text-left" aria-expanded={expanded}>
          <ChevronDown size={18} className={`text-silver-400 transition-transform ${expanded ? "" : "-rotate-90"}`} />
          <div>
            <h2 id="cfg-title" className="text-lg font-semibold text-silver-50">
              Para cobrar de verdad
            </h2>
            <p className="text-sm text-silver-400">
              {!data ? "Revisando la configuración…" : data.readyForLive ? (data.demoMode ? "Todo listo: pon DEMO_MODE=false y vuelve a desplegar." : "Todo listo: la plataforma está cobrando de verdad.") : `Faltan ${data.missing} cosas por configurar.`}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {data && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${data.readyForLive ? "bg-leaf-400/12 text-leaf-300" : "bg-sun-400/12 text-sun-300"}`}>
              {data.readyForLive ? "Listo" : `Faltan ${data.missing}`}
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost !px-3.5 !py-2 text-sm"
            disabled={loading}
            onClick={() => {
              if (probes) void refetch(url);
              setProbes(true);
              setOpen(true);
            }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Probar conexiones
          </button>
        </div>
      </div>
      {expanded && data && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-silver-500">{g}</h3>
              <ul className="mt-2 space-y-2">
                {data.checks
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <li key={c.id} className="flex gap-3 rounded-xl border border-silicon-600/50 bg-silicon-950/30 p-3">
                      <span className="mt-0.5 shrink-0">{STATE_ICON[c.state]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-silver-50">{c.title}</div>
                        <p className="mt-0.5 break-words text-sm text-silver-400">{c.detail}</p>
                        {c.vars && c.state !== "ok" && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {c.vars.map((v) => (
                              <code key={v} className="rounded-md bg-silicon-700/70 px-1.5 py-0.5 text-xs text-silver-200">
                                {v}
                              </code>
                            ))}
                          </div>
                        )}
                        {c.action === "borrar_datos_demo" && (
                          <button type="button" className="btn btn-ghost mt-2 !py-1.5 text-sm text-alert-400" onClick={() => setResetOpen(true)}>
                            <Trash2 size={14} /> Borrar datos de demostración
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

function methodLabel(p: AdminPaymentRow) {
  if (p.method === "wompi") return p.network === "Wompi (sandbox)" ? "Wompi · pruebas" : "Wompi";
  if (p.method === "crypto") return `Cripto · ${p.asset ?? ""}${p.chainId === 97 ? " (testnet)" : ""}`;
  return "Demo";
}

function PaymentActions({ p, explorer }: { p: AdminPaymentRow; explorer: string }) {
  const [mode, setMode] = useState<null | "hash" | "reembolso">(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const r = await postJson<AdminPaymentRow>(`/api/admin/payments/${p.id}`, body);
      toast(`${ok}: ${STATUS[r.status]?.label ?? r.status}`);
      setMode(null);
      setValue("");
      void refetch("/api/admin/overview");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const canReverify = (p.method === "wompi" && !!p.providerId && p.status === "pendiente") || (p.method === "crypto" && p.status === "verificando");
  const canAttach = p.method === "crypto" && p.status === "pendiente" && !p.providerId;
  const canRefund = p.status === "por_reembolsar";
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {canReverify && (
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void run({ action: "reverificar" }, "Re-verificado")}>
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Re-verificar
          </button>
        )}
        {canAttach && (
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setMode(mode === "hash" ? null : "hash")}>
            Registrar hash
          </button>
        )}
        {canRefund && (
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs text-alert-400" onClick={() => setMode(mode === "reembolso" ? null : "reembolso")}>
            Marcar reembolsado
          </button>
        )}
        {p.method === "crypto" && p.txHash && (
          <a href={`${p.chainId === 97 ? "https://testnet.bscscan.com" : explorer}/tx/${p.txHash}`} target="_blank" rel="noreferrer" className="btn btn-ghost !px-3 !py-1.5 text-xs">
            BscScan <ExternalLink size={12} />
          </a>
        )}
      </div>
      {mode && (
        <div className="flex w-full min-w-[260px] gap-1.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "hash" ? "0x… (hash de la transacción)" : "Referencia del reembolso"}
            aria-label={mode === "hash" ? "Hash de la transacción" : "Referencia del reembolso"}
            className="field num !py-1.5 text-xs"
          />
          <button
            type="button"
            className="btn btn-dusk !px-3 !py-1.5 text-xs"
            disabled={busy || value.trim().length < 4}
            onClick={() => void (mode === "hash" ? run({ action: "registrar_hash", txHash: value.trim() }, "Hash registrado") : run({ action: "reembolsado", reference: value.trim() }, "Reembolso registrado"))}
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminPayments() {
  const [filter, setFilter] = useState<PaymentFilter>("todos");
  const [method, setMethod] = useState<"todos" | "wompi" | "crypto" | "demo">("todos");
  const url = `/api/admin/payments?estado=${filter}&metodo=${method}`;
  const { data, loading } = useJson<{ payments: AdminPaymentRow[]; summary: { totalCop: number; todayCop: number; inProgress: number; toRefund: number } }>(url, { refreshMs: 8000 });
  const { config } = useAppConfig();
  const explorer = config?.crypto.explorer ?? "https://bscscan.com";
  const s = data?.summary;
  const payments = data?.payments ?? [];

  return (
    <>
      <AdminTopbar title="Pagos" subtitle="Pagos con Wompi y cripto: estado, verificación y reembolsos." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Recaudado hoy" value={s ? formatCop(s.todayCop) : "—"} />
        <Tile label="Recaudado en total" value={s ? formatCop(s.totalCop) : "—"} />
        <Tile label="En proceso" value={s ? String(s.inProgress) : "—"} />
        <Tile label="Por reembolsar" value={s ? String(s.toRefund) : "—"} alert={!!s && s.toRefund > 0} />
      </div>

      <ConfigChecklist />

      <section className="panel mt-5 overflow-hidden" aria-labelledby="pay-title">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <h2 id="pay-title" className="text-lg font-semibold text-silver-50">
            Órdenes
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-full border border-silicon-600/70 bg-silicon-950/50 p-1" role="tablist" aria-label="Estado">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${filter === f.id ? "bg-silicon-600 text-silver-50" : "text-silver-400 hover:text-silver-100"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="field !w-auto !py-2 text-sm" aria-label="Método de pago">
              <option value="todos">Todos los métodos</option>
              <option value="wompi">Wompi</option>
              <option value="crypto">Cripto</option>
              <option value="demo">Demo</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-silver-400">
              <tr className="border-y border-silicon-600/50">
                <th className="px-5 py-3 font-normal">Fecha</th>
                <th className="px-3 py-3 font-normal">Inversionista</th>
                <th className="px-3 py-3 font-normal">Método</th>
                <th className="px-3 py-3 font-normal">Compra</th>
                <th className="px-3 py-3 font-normal">Estado</th>
                <th className="px-3 py-3 font-normal">Referencia</th>
                <th className="px-5 py-3 font-normal" />
              </tr>
            </thead>
            <tbody className="divide-y divide-silicon-600/40">
              {payments.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="num px-5 py-3.5 text-silver-400">{formatDateTime(p.createdAt)}</td>
                  <td className="px-3 py-3.5">
                    <div className="font-medium text-silver-50">{p.userName}</div>
                    <div className="text-xs text-silver-500">{p.userEmail}</div>
                  </td>
                  <td className="px-3 py-3.5 text-silver-200">{methodLabel(p)}</td>
                  <td className="px-3 py-3.5">
                    <div className="num font-semibold text-silver-50">{formatCop(p.amountCop)}</div>
                    <div className="num text-xs text-silver-400">
                      {formatKw(p.kw ?? 0, 1)}
                      {p.method === "crypto" && p.assetAmount != null && p.asset ? ` · ${formatAsset(p.assetAmount, p.asset)}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs ${STATUS[p.status]?.tone ?? ""}`}>{STATUS[p.status]?.label ?? p.status}</span>
                    {p.providerStatus && <div className="mt-1 text-xs text-silver-500">{p.providerStatus}</div>}
                    {p.note && <div className="mt-1 max-w-[260px] text-xs text-silver-400">{p.note}</div>}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="num text-xs text-silver-200">{p.id}</div>
                    {p.providerId && <div className="num max-w-[200px] truncate text-xs text-silver-500" title={p.providerId}>{p.providerId}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <PaymentActions p={p} explorer={explorer} />
                  </td>
                </tr>
              ))}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-silver-400">
                    No hay pagos en esta lista. Los pagos con Wompi y cripto aparecen aquí apenas se crean.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
