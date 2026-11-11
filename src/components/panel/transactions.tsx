"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  Search,
  X,
  RotateCcw,
} from "lucide-react";
import type { TxDTO } from "@/lib/portfolio";
import { formatCop, formatDateTime, formatNumber } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/data-state";
import { toast } from "@/components/ui/toast";
import {
  explorerTxUrl,
  STATUS_LABEL,
  txAmount,
  txDetail,
  txTitle,
} from "./tx-meta";
import {
  filterTransactions,
  transactionsCsv,
  type TransactionFilter,
} from "./transactions-data";

export function PaymentStatus({ status }: { status: string }) {
  const Icon =
    status === "confirmada"
      ? Check
      : ["fallida", "rechazada", "cancelada"].includes(status)
        ? X
        : ["por_reembolsar", "reembolsada"].includes(status)
          ? RotateCcw
          : Clock3;
  return (
    <span
      className={`payment-status ${status === "confirmada" ? "is-confirmed" : status === "por_reembolsar" ? "is-refund" : ""}`}
    >
      <Icon size={13} aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Transactions({
  transactions,
  compact = false,
}: {
  transactions: readonly TxDTO[];
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<TransactionFilter>({
    search: "",
    status: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TxDTO | null>(null);
  const rows = filterTransactions(transactions, filter);
  const pageSize = compact ? 5 : 10;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = rows.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const change = (value: Partial<TransactionFilter>) => {
    setFilter((previous) => ({ ...previous, ...value }));
    setPage(0);
  };
  const invalidDates = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );
  const explorer = selected ? explorerTxUrl(selected) : null;
  return (
    <>
      {!compact && (
        <div className="transaction-toolbar">
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar movimiento o referencia</span>
            <input
              type="search"
              placeholder="Buscar movimiento o referencia"
              value={filter.search}
              onChange={(event) => change({ search: event.target.value })}
            />
          </label>
          <label className="filter-field">
            Estado
            <select
              value={filter.status}
              onChange={(event) => change({ status: event.target.value })}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Desde
            <input
              type="date"
              value={filter.from}
              max={filter.to || undefined}
              onChange={(event) => change({ from: event.target.value })}
            />
          </label>
          <label className="filter-field">
            Hasta
            <input
              type="date"
              value={filter.to}
              min={filter.from || undefined}
              onChange={(event) => change({ to: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!rows.length || invalidDates}
            onClick={() =>
              download(
                transactionsCsv(rows),
                "text/csv;charset=utf-8",
                "in-world-energy-movimientos.csv",
              )
            }
          >
            <ArrowDownToLine size={15} /> Exportar
          </button>
        </div>
      )}
      {invalidDates && (
        <p role="alert" className="table-note">
          La fecha inicial debe ser anterior o igual a la fecha final.
        </p>
      )}
      <div
        className="transaction-table"
        role="region"
        aria-label="Historial de movimientos"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Movimiento</th>
              <th scope="col">Fecha · Colombia</th>
              <th scope="col">Estado</th>
              <th scope="col">Monto</th>
              <th scope="col">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <strong>{txTitle(tx)}</strong>
                  <span>{tx.id}</span>
                </td>
                <td>{formatDateTime(tx.createdAt)}</td>
                <td>
                  <PaymentStatus status={tx.status} />
                </td>
                <td className={`transaction-amount ${txAmount(tx).tone}`}>
                  {txAmount(tx).text}
                </td>
                <td>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setSelected(tx)}
                    aria-label={`Ver detalle de ${txTitle(tx)}, referencia ${tx.id}`}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <EmptyState
          title={
            transactions.length
              ? "Sin coincidencias"
              : "Tu historial empieza aquí"
          }
          description={
            transactions.length
              ? "Prueba otra búsqueda, estado o rango de fechas."
              : "Tus operaciones aparecerán aquí cuando estén registradas."
          }
        />
      )}
      {!compact && (
        <div className="table-pagination">
          <span role="status">
            {formatNumber(rows.length)} movimientos cargados
            {rows.length ? ` · Página ${currentPage + 1} de ${pages}` : ""}
          </span>
          <div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={currentPage >= pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Detalle del movimiento"
      >
        {selected && (
          <>
            <div className="transaction-detail-summary">
              <PaymentStatus status={selected.status} />
              <p>{formatCop(selected.amountCop)}</p>
              <span>{txTitle(selected)}</span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Referencia</dt>
                <dd>{selected.id}</dd>
              </div>
              <div>
                <dt>Registrado</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
              {selected.confirmedAt !== null && (
                <div>
                  <dt>Confirmado</dt>
                  <dd>{formatDateTime(selected.confirmedAt)}</dd>
                </div>
              )}
              <div>
                <dt>Método</dt>
                <dd>
                  {selected.method === "mercadopago"
                    ? "Mercado Pago"
                    : selected.method === "crypto"
                      ? "Cripto"
                      : selected.method === "demo" ||
                          selected.kind === "asignacion_demo"
                        ? "Prueba"
                        : "Registro de cuenta"}
                </dd>
              </div>
              {selected.txHash && (
                <div>
                  <dt>Referencia externa</dt>
                  <dd>{selected.txHash}</dd>
                </div>
              )}
            </dl>
            {txDetail(selected) && (
              <p className="table-note">{txDetail(selected)}</p>
            )}
            <div className="dialog-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.id);
                    toast("Referencia copiada");
                  } catch {
                    toast(
                      "No se pudo copiar. Selecciona la referencia para copiarla.",
                      "error",
                    );
                  }
                }}
              >
                <Copy size={14} /> Copiar referencia
              </button>
              <button
                type="button"
                className="btn btn-sun"
                onClick={() =>
                  download(
                    transactionsCsv([selected]),
                    "text/csv;charset=utf-8",
                    `in-world-energy-operacion-${selected.id.replace(/[^a-zA-Z0-9-]/g, "")}.csv`,
                  )
                }
              >
                <ArrowDownToLine size={14} /> Resumen
              </button>
            </div>
            {explorer && (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Ver referencia en BscScan <ArrowUpRight size={14} />
              </a>
            )}
            <p className="table-note">
              Resumen informativo de la operación. No sustituye una factura.
            </p>
          </>
        )}
      </Dialog>
    </>
  );
}
