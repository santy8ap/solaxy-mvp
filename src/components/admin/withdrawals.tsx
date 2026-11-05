"use client";
import { Check, Copy, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { PlantSettings } from "@/lib/plant-settings";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { useSettings } from "@/lib/client/use-settings";
import { formatAsset, formatCop, formatDateTime } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import type { AdminWithdrawal } from "./types";

async function saveSettings(next: PlantSettings) {
  const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "No se pudo guardar");
  return json as PlantSettings;
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange(v: boolean): void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-dusk-500" : "bg-silicon-600"} disabled:opacity-50`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-silver-50 shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function CopyValue({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => toast(`${label} copiado`),
          () => toast("No se pudo copiar", "error"),
        );
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-silicon-600/70 px-2 py-1 text-left font-mono text-xs text-silver-200 hover:border-silicon-500"
      title={`Copiar ${label.toLowerCase()}`}
    >
      <span className="break-all">{value}</span>
      <Copy size={12} className="shrink-0 text-silver-400" />
    </button>
  );
}

export function AdminWithdrawals() {
  const { data, loading } = useJson<{ withdrawals: AdminWithdrawal[] }>("/api/admin/withdrawals", { refreshMs: 4000 });
  const { settings, reload } = useSettings();
  const { config } = useAppConfig();
  const realMoney = config ? !config.demoMode : false;
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const list = data?.withdrawals ?? [];
  const pending = list.filter((w) => w.status === "por_aprobar");
  const done = list.filter((w) => w.status !== "por_aprobar").slice(0, 15);

  const decide = async (w: AdminWithdrawal, decision: "aprobar" | "rechazar") => {
    setBusy(w.id);
    try {
      await postJson(`/api/admin/withdrawals/${w.id}`, { decision, reason, reference });
      toast(decision === "aprobar" ? `Aprobaste el retiro de ${formatCop(w.amountCop)} de ${w.userName}` : `Rechazaste el retiro de ${w.userName}`);
      setRejecting(null);
      setApproving(null);
      setReason("");
      setReference("");
      void refetch("/api/admin/withdrawals");
      void refetch("/api/admin/overview");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (value: boolean) => {
    setBusy("toggle");
    try {
      await saveSettings({ ...settings, withdrawalApproval: value });
      await reload();
      toast(value ? "Los retiros ahora esperan tu aprobación." : "Los retiros se aprobarán solos.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AdminTopbar title="Retiros" subtitle="Revisa y aprueba los retiros de ganancias antes de enviarlos." />

      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-silver-50">Requerir aprobación de retiros</h2>
          <p className="mt-1 text-sm text-silver-400">
            {realMoney
              ? "Con dinero real, cada retiro espera aquí: tú haces el envío y registras su referencia. Mientras tanto se aparta el saldo del usuario."
              : settings.withdrawalApproval
                ? "Cada retiro espera aquí hasta que lo apruebes o lo rechaces. Mientras tanto aparta el saldo del usuario."
                : "Los retiros se envían apenas el usuario los firma (solo en modo demo)."}
          </p>
        </div>
        <Switch checked={realMoney || settings.withdrawalApproval} onChange={(v) => void toggle(v)} disabled={realMoney || busy === "toggle"} label="Requerir aprobación de retiros" />
      </section>

      <section className="mt-5" aria-labelledby="pending-title">
        <h2 id="pending-title" className="mb-3 text-lg font-semibold text-silver-50">
          Por aprobar <span className="num text-silver-400">({pending.length})</span>
        </h2>
        <ul className="space-y-3">
          {pending.map((w) => (
            <li key={w.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-silver-50">{w.userName}</div>
                  <div className="num mt-1 text-2xl font-semibold text-silver-50">{formatCop(w.amountCop)}</div>
                  <div className="num text-sm text-silver-400">
                    {w.assetAmount != null && w.asset ? formatAsset(w.assetAmount, w.asset) : ""} a {w.walletName} · {w.network ?? "BNB Smart Chain (BEP-20)"}
                  </div>
                  {w.walletAddress && (
                    <div className="mt-2">
                      <CopyValue value={w.walletAddress} label="Dirección" />
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-silver-500">
                    <span className="num">{formatDateTime(w.createdAt)}</span>
                    {w.signed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-leaf-400/10 px-2 py-0.5 text-leaf-300">
                        <ShieldCheck size={12} /> Firma de la wallet verificada
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost !py-2.5 text-sm"
                    disabled={busy === w.id}
                    onClick={() => {
                      setApproving(null);
                      setRejecting(rejecting === w.id ? null : w.id);
                    }}
                  >
                    <X size={16} /> Rechazar
                  </button>
                  <button
                    type="button"
                    className="btn btn-dusk !py-2.5 text-sm"
                    disabled={busy === w.id}
                    onClick={() => {
                      setRejecting(null);
                      setApproving(approving === w.id ? null : w.id);
                    }}
                  >
                    <Check size={16} /> Aprobar
                  </button>
                </div>
              </div>
              {approving === w.id && (
                <div className="mt-4 border-t border-silicon-600/50 pt-4">
                  <label htmlFor={`ref-${w.id}`} className="text-sm text-silver-300">
                    Referencia del envío {realMoney ? "" : "(opcional en modo demo)"}
                  </label>
                  <p className="mt-1 text-xs text-silver-500">
                    Primero envía el dinero a la dirección de arriba. Luego pega aquí el hash de la transacción o el número del comprobante bancario.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      id={`ref-${w.id}`}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={120}
                      placeholder="0x… o número de comprobante"
                      className="field num min-w-[240px] flex-1"
                    />
                    <button
                      type="button"
                      className="btn btn-dusk text-sm"
                      disabled={busy === w.id || (realMoney && reference.trim().length < 6)}
                      onClick={() => void decide(w, "aprobar")}
                    >
                      {busy === w.id ? "Aprobando…" : "Confirmar aprobación"}
                    </button>
                  </div>
                </div>
              )}
              {rejecting === w.id && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-silicon-600/50 pt-4">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Motivo del rechazo (lo verá el usuario)" className="field min-w-[220px] flex-1" aria-label="Motivo del rechazo" />
                  <button type="button" className="btn btn-ghost text-sm" disabled={busy === w.id} onClick={() => void decide(w, "rechazar")}>
                    Confirmar rechazo
                  </button>
                </div>
              )}
            </li>
          ))}
          {!loading && pending.length === 0 && (
            <li className="panel-quiet p-8 text-center text-silver-400">No hay retiros esperando. Cuando un usuario pida uno, aparecerá aquí al instante.</li>
          )}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="panel mt-6 p-5 sm:p-6" aria-labelledby="done-title">
          <h2 id="done-title" className="text-lg font-semibold text-silver-50">
            Revisados recientemente
          </h2>
          <ul className="mt-3 divide-y divide-silicon-600/40">
            {done.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <span className="font-medium text-silver-50">{w.userName}</span>
                  <span className="num ml-2 text-silver-400">{formatDateTime(w.createdAt)}</span>
                  {w.status === "rechazada" && w.note && <div className="text-xs text-silver-500">Motivo: {w.note}</div>}
                  {w.status === "confirmada" && w.txHash && <div className="num break-all text-xs text-silver-500">Referencia: {w.txHash}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="num font-semibold text-silver-100">{formatCop(w.amountCop)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${w.status === "confirmada" ? "bg-leaf-400/12 text-leaf-300" : "bg-alert-400/12 text-alert-400"}`}>
                    {w.status === "confirmada" ? "Aprobado" : "Rechazado"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export { saveSettings, Switch };
