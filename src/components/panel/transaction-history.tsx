"use client";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatDateTime } from "@/lib/format";
import { isoColombiaDate } from "@/lib/history-filters";
import { DAY_MS } from "@/lib/time";
import type { TransactionHistory as HistoryDTO } from "@/lib/transactions";
import { ReceiptButton } from "@/components/payments/receipt-button";
import { ErrorNote } from "@/components/ui/field";
import { Status, TX_STATUS } from "@/components/ui/status";
import { explorerTxUrl, isEvmHash, txDetail, txTitle } from "./tx-meta";

const INITIAL = {
  desde: "",
  hasta: "",
  tipo: "todos",
  estado: "todos",
  pagina: 1,
};

export function TransactionHistory({ asOf }: { asOf: number }) {
  const [draft, setDraft] = useState(INITIAL);
  const [filters, setFilters] = useState(INITIAL);
  const [problem, setProblem] = useState<string | null>(null);
  const query = useMemo(
    () =>
      new URLSearchParams(
        Object.entries(filters).map(([key, value]) => [key, String(value)]),
      ),
    [filters],
  );
  const { data, error, reload } = useJson<HistoryDTO>(
    `/api/transactions?${query}`,
    { refreshMs: 30_000 },
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const chooseRange = (days: number) => {
    const next = {
      ...draft,
      desde: days ? isoColombiaDate(asOf - (days - 1) * DAY_MS) : "",
      hasta: days ? isoColombiaDate(asOf) : "",
      pagina: 1,
    };
    setDraft(next);
    setFilters(next);
    setProblem(null);
  };

  return (
    <section className="mt-16" aria-label="Historial completo de movimientos">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line-strong pb-5">
        <div>
          <h2 className="text-xl font-medium">Historial de movimientos</h2>
          <p className="mt-2 text-sm text-mute">
            Consulta pagos, retiros y operaciones pendientes.
          </p>
        </div>
        <a
          href={`/api/transactions/export?${query}`}
          className="btn btn-ghost"
          download
        >
          <Download size={15} /> Exportar CSV
        </a>
      </div>
      <div className="mt-6 flex flex-wrap gap-2" aria-label="Períodos rápidos">
        {[
          [0, "Todo el historial"],
          [7, "7 días"],
          [30, "30 días"],
          [90, "90 días"],
        ].map(([days, label]) => (
          <button
            type="button"
            key={days}
            className="btn btn-ghost !min-h-9 !px-3 !py-2 !text-[0.65rem]"
            onClick={() => chooseRange(Number(days))}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="mt-6 grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.desde && draft.hasta && draft.desde > draft.hasta) {
            setProblem(
              "La fecha inicial debe ser anterior o igual a la final.",
            );
            return;
          }
          setProblem(null);
          setFilters({ ...draft, pagina: 1 });
        }}
      >
        <label className="cap">
          Desde
          <input
            type="date"
            value={draft.desde}
            onChange={(event) =>
              setDraft((value) => ({ ...value, desde: event.target.value }))
            }
            className="field num mt-2"
          />
        </label>
        <label className="cap">
          Hasta
          <input
            type="date"
            value={draft.hasta}
            onChange={(event) =>
              setDraft((value) => ({ ...value, hasta: event.target.value }))
            }
            className="field num mt-2"
          />
        </label>
        <label className="cap">
          Tipo
          <select
            value={draft.tipo}
            onChange={(event) =>
              setDraft((value) => ({ ...value, tipo: event.target.value }))
            }
            className="field mt-2"
          >
            <option value="todos">Todos</option>
            <option value="plan_mes">Pagos de paquetes</option>
            <option value="retiro">Retiros</option>
          </select>
        </label>
        <label className="cap">
          Estado
          <select
            value={draft.estado}
            onChange={(event) =>
              setDraft((value) => ({ ...value, estado: event.target.value }))
            }
            className="field mt-2"
          >
            <option value="todos">Todos</option>
            {Object.entries(TX_STATUS).map(([value, status]) => (
              <option key={value} value={value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-solid">
          Filtrar
        </button>
      </form>
      {(problem || error) && (
        <div className="mt-6">
          <ErrorNote>{problem ?? error}</ErrorNote>
          {error && (
            <button
              type="button"
              className="link mt-3 text-sm"
              onClick={() => void reload()}
            >
              Volver a cargar
            </button>
          )}
        </div>
      )}
      {!data ? (
        <div
          className="skeleton mt-8 h-64"
          aria-busy="true"
          aria-label="Cargando movimientos"
        />
      ) : !data.transactions.length ? (
        <p className="py-12 text-mute">
          No hay movimientos para este período y estos filtros.
        </p>
      ) : (
        <ul className="mt-8 border-t border-line">
          {data.transactions.map((tx) => {
            const status = TX_STATUS[tx.status] ?? TX_STATUS.pendiente;
            const explorer = explorerTxUrl(tx);
            const receiptAvailable =
              tx.status === "confirmada" &&
              !["refunded", "charged_back", "cancelled"].includes(
                tx.providerStatus ?? "",
              );
            return (
              <li
                key={tx.id}
                className="grid min-w-0 gap-x-8 gap-y-3 border-b border-line py-6 sm:grid-cols-[12.5rem_minmax(0,1fr)_auto]"
              >
                <p className="num whitespace-nowrap text-sm text-mute">
                  {formatDateTime(tx.createdAt)}
                </p>
                <div className="min-w-0">
                  <p>
                    {txTitle(tx)}
                    {tx.planName ? ` · ${tx.planName}` : ""}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-fog">
                    {txDetail(tx)}
                  </p>
                  <p className="num mt-2 break-all text-xs text-mute">
                    {tx.id}
                    {tx.kind === "retiro" &&
                    tx.status === "confirmada" &&
                    tx.txHash &&
                    !isEvmHash(tx.txHash)
                      ? ` · Comprobante ${tx.txHash}`
                      : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
                    {receiptAvailable && <ReceiptButton id={tx.id} compact />}
                    {tx.method === "mercadopago" &&
                      ["pendiente", "verificando"].includes(tx.status) && (
                        <Link
                          href={`/pagos/resultado?ref=${encodeURIComponent(tx.id)}`}
                          className="link text-sm"
                        >
                          Consultar pago
                        </Link>
                      )}
                    {explorer && (
                      <a
                        href={explorer}
                        target="_blank"
                        rel="noreferrer"
                        className="link inline-flex items-center gap-2 text-sm text-fog"
                      >
                        Ver en BscScan <ExternalLink size={12} />
                      </a>
                    )}
                    <Link
                      href={`/ayuda?ref=${encodeURIComponent(tx.id)}`}
                      className="link text-sm text-mute"
                    >
                      Ayuda con esta operación
                    </Link>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-5 sm:block sm:text-right">
                  <p
                    className={`num text-lg ${status.tone === "off" ? "text-dim line-through" : ""}`}
                  >
                    {tx.kind === "retiro" ? "−" : ""}
                    {formatCop(tx.amountCop)}
                  </p>
                  <p className="sm:mt-3">
                    <Status tone={status.tone}>{status.label}</Status>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data && data.total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-mute">
            Página {data.page} de {pages} · {data.total} movimientos
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost !px-3"
              disabled={data.page <= 1}
              onClick={() =>
                setFilters((value) => ({
                  ...value,
                  pagina: Math.max(1, value.pagina - 1),
                }))
              }
              aria-label="Página anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="btn btn-ghost !px-3"
              disabled={data.page >= pages}
              onClick={() =>
                setFilters((value) => ({ ...value, pagina: value.pagina + 1 }))
              }
              aria-label="Página siguiente"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
