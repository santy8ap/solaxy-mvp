import type { TxDTO } from "@/lib/portfolio";
import { STATUS_LABEL, txTitle } from "./tx-meta";

export interface TransactionFilter {
  search: string;
  status: string;
  from: string;
  to: string;
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function day(ts: number) {
  const parts = dateParts.formatToParts(ts);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function filterTransactions(
  transactions: readonly TxDTO[],
  filter: TransactionFilter,
): TxDTO[] {
  if (filter.from && filter.to && filter.from > filter.to) return [];
  const search = normalize(filter.search.trim());
  return transactions
    .filter((tx) => {
      if (filter.status && tx.status !== filter.status) return false;
      const date = day(tx.createdAt);
      if (
        (filter.from && date < filter.from) ||
        (filter.to && date > filter.to)
      )
        return false;
      return (
        !search ||
        normalize(
          `${tx.id} ${txTitle(tx)} ${tx.txHash ?? ""} ${tx.method ?? ""}`,
        ).includes(search)
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}
/** Quote every cell and neutralize spreadsheet formulas in provider/user text. */
function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[\s]*[=+@\-\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function transactionsCsv(transactions: readonly TxDTO[]) {
  const header = [
    "Referencia",
    "Movimiento",
    "Fecha UTC",
    "Estado",
    "Monto COP",
    "Método",
    "Referencia externa",
  ];
  const rows = transactions.map((tx) => [
    tx.id,
    txTitle(tx),
    new Date(tx.createdAt).toISOString(),
    STATUS_LABEL[tx.status] ?? tx.status,
    tx.amountCop,
    tx.method ?? "",
    tx.txHash ?? "",
  ]);
  return (
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")
  );
}
