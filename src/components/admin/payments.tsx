"use client";
import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { AdminPaymentRow, PaymentFilter } from "@/lib/admin/payments";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { adminMethodLabel } from "@/lib/labels";
import { transferReference } from "@/lib/transfer-reference";
import {
  formatAsset,
  formatCop,
  formatDateTime,
  formatNumber,
} from "@/lib/format";
import { explorerTxUrl, paymentMethodLabel } from "@/components/panel/tx-meta";
import { ErrorNote, Field } from "@/components/ui/field";
import { Status, TX_STATUS } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";


const FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "en_proceso", label: "En proceso" },
  { id: "confirmadas", label: "Confirmados" },
  { id: "fallidas", label: "No aprobados" },
  { id: "por_reembolsar", label: "Reembolsos" },
];

type MethodFilter =
  | "todos"
  | "mercadopago"
  | "crypto"
  | "transferencia"
  | "manual"
  | "demo";

interface PaymentsResponse {
  payments: AdminPaymentRow[];
  summary: {
    totalCop: number;
    todayCop: number;
    inProgress: number;
    toRefund: number;
  };
}

/* ───────────── Pagos ───────────── */

function PaymentActions({
  p,
  listUrl,
}: {
  p: AdminPaymentRow;
  listUrl: string;
}) {
  const [mode, setMode] = useState<
    | null
    | "hash"
    | "reembolso"
    | "conciliar"
    | "confirmar_transferencia"
    | "rechazar_transferencia"
  >(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      const r = await postJson<AdminPaymentRow>(
        `/api/admin/payments/${p.id}`,
        body,
      );
      toast(
        `${done}: ${(TX_STATUS[r.status]?.label ?? r.status).toLowerCase()}.`,
      );
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
  // Mercado Pago se consulta por la referencia de la orden: sirve aunque el comercializador no haya vuelto del pago.
  const canReverify =
    (p.method === "mercadopago" &&
      [
        "pendiente",
        "verificando",
        "fallida",
        "confirmada",
        "reembolsada",
      ].includes(p.status)) ||
    (p.method === "crypto" && p.status === "verificando");
  const canAttach =
    p.method === "crypto" && p.status === "pendiente" && !p.providerId;
  const canRefund = p.status === "por_reembolsar";
  // Transferencia que reportó el comercializador: el admin la busca en el banco y la confirma o la rechaza.
  const canReviewTransfer =
    p.method === "transferencia" &&
    (p.status === "pendiente" || p.status === "verificando");
  const explorer = p.method === "crypto" ? explorerTxUrl(p) : null;
  if (
    !canReverify &&
    !canAttach &&
    !canRefund &&
    !canReviewTransfer &&
    !p.reviewRequired &&
    !explorer
  )
    return null;
  const validHash = /^0x[0-9a-fA-F]{64}$/.test(value.trim());

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {canReverify && (
          <button
            type="button"
            className="link inline-flex items-center gap-1.5"
            disabled={busy}
            onClick={() => void run({ action: "reverificar" }, "Consultado")}
          >
            <RefreshCw
              size={13}
              strokeWidth={1.5}
              className={busy ? "animate-spin" : ""}
              aria-hidden="true"
            />{" "}
            Volver a verificar
          </button>
        )}
        {canReviewTransfer && (
          <>
            <button
              type="button"
              className="link"
              aria-expanded={mode === "confirmar_transferencia"}
              onClick={() =>
                setMode(
                  mode === "confirmar_transferencia"
                    ? null
                    : "confirmar_transferencia",
                )
              }
            >
              Confirmar la transferencia
            </button>
            <button
              type="button"
              className="link"
              aria-expanded={mode === "rechazar_transferencia"}
              onClick={() =>
                setMode(
                  mode === "rechazar_transferencia"
                    ? null
                    : "rechazar_transferencia",
                )
              }
            >
              No llegó
            </button>
          </>
        )}
        {canAttach && (
          <button
            type="button"
            className="link"
            aria-expanded={mode === "hash"}
            onClick={() => setMode(mode === "hash" ? null : "hash")}
          >
            Registrar el hash
          </button>
        )}
        {canRefund && (
          <button
            type="button"
            className="link"
            aria-expanded={mode === "reembolso"}
            onClick={() => setMode(mode === "reembolso" ? null : "reembolso")}
          >
            Marcar como reembolsado
          </button>
        )}
        {p.reviewRequired && (
          <button
            type="button"
            className="link"
            aria-expanded={mode === "conciliar"}
            onClick={() => setMode(mode === "conciliar" ? null : "conciliar")}
          >
            Registrar conciliación
          </button>
        )}
        {explorer && (
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer"
            className="link inline-flex items-center gap-1.5"
          >
            Ver en BscScan <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
      {mode === "confirmar_transferencia" && (
        <p className="mt-3 max-w-[68ch] text-sm text-fog">
          Confírmala solo cuando veas en el banco {formatCop(p.amountCop)} con
          la referencia{" "}
          {p.subscriptionId && p.periodIndex
            ? transferReference(p.subscriptionId, p.periodIndex)
            : "del plan"}
          . Al guardar se activa el mes y la energía empieza a contar.
        </p>
      )}
      {mode === "rechazar_transferencia" && (
        <p className="mt-3 max-w-[68ch] text-sm text-fog">
          El comercializador verá el motivo en sus movimientos y podrá pagar el
          mes otra vez.
        </p>
      )}
      {mode === "conciliar" && (
        <p className="mt-3 max-w-[68ch] text-sm text-fog">
          Registra el acuerdo solo después de revisar el saldo, los retiros y
          las demás mensualidades con el titular. Esto habilita los retiros; no
          envía dinero, no descuenta saldos y no reactiva el período devuelto.
        </p>
      )}
      {mode && (
        <form
          className="mt-3 flex max-w-[560px] flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = value.trim();
            void (mode === "hash"
              ? run({ action: "registrar_hash", txHash: v }, "Hash registrado")
              : mode === "conciliar"
                ? run(
                    { action: "conciliar", reference: v },
                    "Conciliación registrada",
                  )
                : mode === "confirmar_transferencia"
                  ? run(
                      { action: "confirmar_transferencia", reference: v },
                      "Transferencia revisada",
                    )
                  : mode === "rechazar_transferencia"
                    ? run(
                        { action: "rechazar_transferencia", reason: v },
                        "Transferencia revisada",
                      )
                    : run(
                        { action: "reembolsado", reference: v },
                        "Reembolso registrado",
                      ));
          }}
        >
          <Field
            label={
              mode === "hash"
                ? "Hash de la transacción (0x…)"
                : mode === "conciliar"
                  ? "Conciliación y referencia del acuerdo"
                  : mode === "confirmar_transferencia"
                    ? "Referencia del movimiento en el banco"
                    : mode === "rechazar_transferencia"
                      ? "Motivo (lo ve el comercializador)"
                      : "Referencia del reembolso"
            }
            className="min-w-[220px] flex-1"
          >
            {(id, aria) => (
              <input
                id={id}
                {...aria}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                className="field num"
              />
            )}
          </Field>
          <button
            type="submit"
            className="btn btn-solid"
            disabled={
              busy ||
              (mode === "hash"
                ? !validHash
                : value.trim().length < (mode === "conciliar" ? 12 : 4))
            }
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </form>
      )}
    </div>
  );
}

function PaymentRow({ p, listUrl }: { p: AdminPaymentRow; listUrl: string }) {
  const st = TX_STATUS[p.status] ?? TX_STATUS.pendiente;
  const what = [
    p.planName,
    p.periodIndex ? `mes ${p.periodIndex}` : null,
    p.kwh ? `${formatNumber(p.kwh)} kWh` : null,
  ]
    .filter(Boolean)
    .join(", ");
  // Lo que respondió la pasarela o la red. En un pago de prueba o registrado a mano no agrega nada.
  const provider =
    p.method === "transferencia"
      ? [
          p.subscriptionId && p.periodIndex
            ? `Referencia en el banco: ${transferReference(p.subscriptionId, p.periodIndex)}`
            : null,
          p.txHash ? `comprobante del comercializador: ${p.txHash}` : null,
        ]
          .filter(Boolean)
          .join(", ") || null
      : !p.providerStatus
        ? null
        : p.method === "mercadopago"
          ? `Estado en Mercado Pago: ${p.providerStatus}`
          : p.method === "crypto"
            ? `En la red: ${p.providerStatus}`
            : null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-2 border-b border-line py-5 lg:grid-cols-[12.5rem_minmax(0,1fr)_auto] lg:items-baseline">
      <p className="num whitespace-nowrap text-sm text-mute">{formatDateTime(p.createdAt)}</p>
      <div className="min-w-0">
        <p className="font-medium">{p.companyName || p.userName}</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-mute">
          {what ? `${what}. ` : ""}
          {p.method === "manual" ? adminMethodLabel(p.method) : paymentMethodLabel(p)}
          {p.method === "crypto" && p.assetAmount != null && p.asset
            ? `, ${formatAsset(p.assetAmount, p.asset)}`
            : ""}
          {provider ? `. ${provider}` : ""}
        </p>
        {p.note && (
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-fog">
            {p.note}
          </p>
        )}
        <p className="num mt-1 break-all text-xs text-dim">
          {p.id}
          {p.providerId ? ` · ${p.providerId}` : ""}
          {p.userEmail ? ` · ${p.userEmail}` : ""}
        </p>
        <PaymentActions p={p} listUrl={listUrl} />
      </div>
      <div className="flex items-baseline justify-between gap-6 lg:block lg:text-right">
        <p
          className={`num text-lg ${st.tone === "off" ? "text-dim line-through" : ""}`}
        >
          {formatCop(p.amountCop)}
        </p>
        <p className="lg:mt-2">
          <Status tone={st.tone}>{st.label}</Status>
        </p>
      </div>
    </li>
  );
}

const FILTER_IDS = new Set<string>(FILTERS.map((f) => f.id));
const METHOD_IDS = new Set<string>(["todos", "mercadopago", "crypto", "transferencia", "manual", "demo"]);

export function AdminPayments() {
  // Los filtros llegan también por la URL: desde el Resumen, la ficha de un cliente o un enlace guardado.
  const params = useSearchParams();
  const [filter, setFilter] = useState<PaymentFilter>(() => {
    const v = params.get("estado") ?? "";
    return FILTER_IDS.has(v) ? (v as PaymentFilter) : "todos";
  });
  const [method, setMethod] = useState<MethodFilter>(() => {
    const v = params.get("metodo") ?? "";
    return METHOD_IDS.has(v) ? (v as MethodFilter) : "todos";
  });
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [client, setClient] = useState(() => params.get("cliente") ?? "");
  const qs = new URLSearchParams({ estado: filter, metodo: method, ...(search && { q: search }), ...(client && { cliente: client }) }).toString();
  const url = `/api/admin/payments?${qs}`;
  const { data, loading, error } = useJson<PaymentsResponse>(url, {
    refreshMs: 10_000,
  });
  const { config } = useAppConfig();
  const s = data?.summary;
  const payments = data?.payments ?? [];
  const confirmedCop = payments.filter((p) => p.status === "confirmada").reduce((sum, p) => sum + p.amountCop, 0);
  const clientName = client ? (payments[0]?.companyName || payments[0]?.userName || "este cliente") : null;

  return (
    <>
      <AdminTopbar
        title="Pagos"
        subtitle="Las mensualidades que pagan los comercializadores: su estado, su verificación y los reembolsos."
      />

      <dl className="grid border-t border-line-strong sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recaudado hoy", value: s ? formatCop(s.todayCop) : "—" },
          {
            label: "Recaudado en total",
            value: s ? formatCop(s.totalCop) : "—",
          },
          { label: "En proceso", value: s ? String(s.inProgress) : "—" },
          {
            label: "Por reembolsar",
            value: s ? String(s.toRefund) : "—",
            alert: !!s && s.toRefund > 0,
          },
        ].map((t) => (
          <div key={t.label} className="border-b border-line py-5 pr-6">
            <dt className="cap">{t.label}</dt>
            <dd
              className={`num mt-2 text-[1.5rem] leading-tight ${t.alert ? "inline-block bg-ink px-2 text-void" : ""}`}
            >
              {t.value}
            </dd>
          </div>
        ))}
      </dl>
      {config && (
        <p className="mt-3 text-sm text-mute">
          {config.demoMode ? (
            <>
              En modo de pruebas el recaudo incluye los pagos de prueba. Lo que falta para cobrar dinero real está en{" "}
              <Link href="/admin/configuracion" className="link text-ink">
                Configuración
              </Link>
              .
            </>
          ) : (
            "El recaudo solo cuenta dinero real: un pago de prueba que quede en la lista no suma."
          )}
        </p>
      )}

      <section className="mt-14" aria-labelledby="pay-title">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-strong pb-4">
          <h2 id="pay-title" className="text-xl font-medium">
            Pagos recibidos
          </h2>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div
              className="flex flex-wrap gap-x-5 gap-y-2"
              role="group"
              aria-label="Filtrar por estado"
            >
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
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as MethodFilter)}
                className="field !w-auto !py-1.5 text-sm"
              >
                <option value="todos">Todos los medios</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="crypto">Cripto</option>
                <option value="transferencia">Transferencia bancaria</option>
                <option value="manual">Registrado a mano</option>
                <option value="demo">Pago de prueba</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <form
            role="search"
            className="flex w-full max-w-[520px] items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
            }}
          >
            <div className="flex-1">
              <label htmlFor="pay-q" className="cap">
                Buscar por cliente, NIT, orden o referencia
              </label>
              <input id="pay-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} className="field" />
            </div>
            <button type="submit" className="btn btn-ghost">
              Buscar
            </button>
          </form>
          <a href={`/api/admin/payments/export?${qs}`} className="link text-sm" download>
            Exportar esta lista (CSV)
          </a>
        </div>
        {(client || search) && (
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fog">
            {client && <span>Solo los pagos de {clientName}.</span>}
            {search && <span>Que coinciden con «{search}».</span>}
            <button
              type="button"
              className="link"
              onClick={() => {
                setClient("");
                setSearch("");
                setQuery("");
              }}
            >
              Ver todos
            </button>
          </p>
        )}
        {data && (
          <p className="num mt-4 text-sm text-mute">
            {payments.length === 200 ? "Los 200 más recientes" : `${payments.length} ${payments.length === 1 ? "pago" : "pagos"}`} · confirmados {formatCop(confirmedCop)}
          </p>
        )}
        {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
        <ul>
          {payments.map((p) => (
            <PaymentRow key={p.id} p={p} listUrl={url} />
          ))}
        </ul>
        {!loading && !error && payments.length === 0 && (
          <p className="py-10 text-mute">
            {search || client ? "Ningún pago coincide con esa búsqueda." : "No hay pagos en esta lista. Aparecen aquí apenas un comercializador empieza a pagar."}
          </p>
        )}
        {loading && !data && (
          <div
            className="skeleton mt-6 h-40"
            aria-busy="true"
            aria-label="Cargando los pagos"
          />
        )}
      </section>
    </>
  );
}
