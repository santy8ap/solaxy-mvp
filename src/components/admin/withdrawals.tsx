"use client";
import { Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatAsset, formatCop, formatDateTime } from "@/lib/format";
import { accountTypeLabel } from "@/lib/withdrawal-schema";
import { isEvmHash } from "@/components/panel/tx-meta";
import { ErrorNote, Field } from "@/components/ui/field";
import { Status } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import type { AdminWithdrawal } from "./types";

const LIST_URL = "/api/admin/withdrawals";

/** Un dato que el administrador va a pegar en el banco o en la wallet: se copia con un toque. */
function CopyValue({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => toast(`${label}: copiado.`),
          () => toast("No se pudo copiar.", "error"),
        );
      }}
      className="num group inline-flex max-w-full items-start gap-2 text-left hover:text-ink"
      aria-label={`Copiar ${label.toLowerCase()}: ${value}`}
    >
      <span className="break-all">{value}</span>
      <Copy size={13} strokeWidth={1.5} className="mt-1 shrink-0 text-mute group-hover:text-ink" aria-hidden="true" />
    </button>
  );
}

function Datum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="cap">{label}</dt>
      <dd className="mt-1.5 break-words">{children}</dd>
    </div>
  );
}

const ownerOf = (w: AdminWithdrawal) => w.companyName || w.userName;

function PendingWithdrawal({ w, realMoney }: { w: AdminWithdrawal; realMoney: boolean }) {
  const [mode, setMode] = useState<null | "aprobar" | "rechazar">(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toBank = !!w.bankName;

  const decide = async (decision: "aprobar" | "rechazar") => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`${LIST_URL}/${w.id}`, { decision, reason, reference });
      toast(decision === "aprobar" ? `Retiro de ${formatCop(w.amountCop)} aprobado.` : "Retiro rechazado: el saldo volvió a quedar disponible.");
      void refetch(LIST_URL);
      void refetch("/api/admin/overview");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <li className="border-b border-line py-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div>
          <p className="cap">{ownerOf(w)}</p>
          <p className="figure mt-3 text-[clamp(2.6rem,6vw,4rem)]">{formatCop(w.amountCop)}</p>
          <p className="num mt-3 text-sm text-mute">
            Pedido el {formatDateTime(w.createdAt)}
            <br />
            {w.id}
          </p>
        </div>
        <div>
          {toBank ? (
            <>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
                <Datum label="Banco">{w.bankName}</Datum>
                <Datum label="Tipo de cuenta">{accountTypeLabel(w.bankAccountType)}</Datum>
                <Datum label="Número de cuenta">{w.bankAccountNumber ? <CopyValue value={w.bankAccountNumber} label="Número de cuenta" /> : "Sin registrar"}</Datum>
              </dl>
              <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-fog">
                Antes de transferir, verifica en el banco que la cuenta esté a nombre de {ownerOf(w)}
                {w.nit ? ` (NIT ${w.nit})` : ""}. Solo se paga a cuentas de la misma empresa.
              </p>
            </>
          ) : (
            <>
              <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                <Datum label="Enviar">{w.assetAmount != null && w.asset ? <span className="num">{formatAsset(w.assetAmount, w.asset)}</span> : "USDT"}</Datum>
                <Datum label={`Dirección en ${w.network ?? "BNB Smart Chain (BEP-20)"}`}>{w.walletAddress ? <CopyValue value={w.walletAddress} label="Dirección" /> : "Sin registrar"}</Datum>
              </dl>
              <p className="mt-5 flex max-w-[62ch] items-start gap-2 text-sm leading-relaxed text-fog">
                <ShieldCheck size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
                {w.signed ? `${ownerOf(w)} firmó la solicitud con esa wallet (${w.walletName ?? "wallet"}): es suya.` : "La solicitud no trae la firma de la wallet: no la apruebes sin confirmar la dirección con la empresa."}
              </p>
            </>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" className={`btn ${mode === "aprobar" ? "btn-solid" : "btn-ghost"}`} aria-expanded={mode === "aprobar"} disabled={busy} onClick={() => setMode(mode === "aprobar" ? null : "aprobar")}>
              Ya lo pagué
            </button>
            <button type="button" className={`btn ${mode === "rechazar" ? "btn-solid" : "btn-ghost"}`} aria-expanded={mode === "rechazar"} disabled={busy} onClick={() => setMode(mode === "rechazar" ? null : "rechazar")}>
              Rechazar
            </button>
          </div>

          {mode === "aprobar" && (
            <form
              className="mt-7 max-w-[520px] space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void decide("aprobar");
              }}
            >
              <Field
                label="Referencia del envío"
                hint={`${toBank ? "El número del comprobante de la transferencia." : "El hash de la transacción (0x…)."} La empresa lo verá en sus movimientos.${realMoney ? "" : " En modo de pruebas puedes dejarla vacía."}`}
              >
                {(id, aria) => <input id={id} {...aria} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} autoComplete="off" className="field num" />}
              </Field>
              <button type="submit" className="btn btn-solid" disabled={busy || (realMoney && reference.trim().length < 6)}>
                {busy ? "Guardando…" : "Confirmar el pago"}
              </button>
            </form>
          )}
          {mode === "rechazar" && (
            <form
              className="mt-7 max-w-[520px] space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void decide("rechazar");
              }}
            >
              <Field label="Motivo del rechazo" hint="La empresa lo verá en sus movimientos y el saldo vuelve a quedar disponible.">
                {(id, aria) => <input id={id} {...aria} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoComplete="off" className="field" />}
              </Field>
              <button type="submit" className="btn btn-solid" disabled={busy || reason.trim().length < 4}>
                {busy ? "Guardando…" : "Confirmar el rechazo"}
              </button>
            </form>
          )}
          {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
        </div>
      </div>
    </li>
  );
}

function ReviewedWithdrawal({ w }: { w: AdminWithdrawal }) {
  const paid = w.status === "confirmada";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-2 border-b border-line py-5 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:items-baseline">
      <p className="num text-sm text-mute">{formatDateTime(w.confirmedAt ?? w.createdAt)}</p>
      <div className="min-w-0">
        <p className="font-medium">{ownerOf(w)}</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-mute">
          {w.bankName ? `${w.bankName}, ${accountTypeLabel(w.bankAccountType).toLowerCase()} ${w.bankAccountNumber ?? ""}` : `${w.walletName ?? "Wallet"} ${w.walletAddress ?? ""}`}
        </p>
        {paid && w.txHash && (
          <p className="num mt-1 break-all text-xs text-dim">
            {isEvmHash(w.txHash) ? "Hash" : "Comprobante"} {w.txHash}
          </p>
        )}
        {!paid && w.note && <p className="mt-1 text-sm leading-relaxed text-fog">Motivo: {w.note}</p>}
      </div>
      <div className="flex items-baseline justify-between gap-6 sm:block sm:text-right">
        <p className={`num text-lg ${paid ? "" : "text-dim line-through"}`}>{formatCop(w.amountCop)}</p>
        <p className="sm:mt-2">
          <Status tone={paid ? "ok" : "off"}>{paid ? "Pagado" : "Rechazado"}</Status>
        </p>
      </div>
    </li>
  );
}

export function AdminWithdrawals() {
  const { data, loading, error } = useJson<{ withdrawals: AdminWithdrawal[] }>(LIST_URL, { refreshMs: 10_000 });
  const { config } = useAppConfig();
  const realMoney = config ? !config.demoMode : true;
  const list = data?.withdrawals ?? [];
  const pending = list.filter((w) => w.status === "por_aprobar");
  const reviewed = list.filter((w) => w.status !== "por_aprobar").slice(0, 30);

  return (
    <>
      <AdminTopbar title="Retiros" subtitle="Cada retiro espera aquí con el saldo apartado. Haces el envío desde el banco o la wallet de la empresa y registras su referencia." />
      {error && <ErrorNote className="mb-8">{error}</ErrorNote>}

      <section aria-labelledby="pending-title">
        <h2 id="pending-title" className="border-b border-line-strong pb-4 text-xl font-medium">
          Por revisar <span className="num text-mute">{pending.length}</span>
        </h2>
        {loading && !data ? (
          <div className="skeleton mt-6 h-40" aria-busy="true" aria-label="Cargando los retiros" />
        ) : pending.length ? (
          <ul>
            {pending.map((w) => (
              <PendingWithdrawal key={w.id} w={w} realMoney={realMoney} />
            ))}
          </ul>
        ) : (
          <p className="py-10 text-mute">No hay retiros esperando. Cuando una empresa pida uno, aparece aquí.</p>
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="mt-14" aria-labelledby="reviewed-title">
          <h2 id="reviewed-title" className="border-b border-line-strong pb-4 text-xl font-medium">
            Revisados
          </h2>
          <ul>
            {reviewed.map((w) => (
              <ReviewedWithdrawal key={w.id} w={w} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
