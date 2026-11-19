import "server-only";
import { csvLine } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { txStatusLabel } from "@/lib/labels";
import { accountKindLabel } from "@/lib/withdrawal-schema";
import type { listWithdrawals } from "./service";

type Row = Awaited<ReturnType<typeof listWithdrawals>>[number];

/** Los retiros en CSV para la contabilidad: a quién, a dónde, cuánto y con qué referencia se pagó. */
export function withdrawalsCsv(rows: readonly Row[]) {
  let csv =
    "﻿" +
    csvLine(["Solicitado (Colombia)", "Pagado o rechazado (Colombia)", "Retiro", "Cliente", "Titular", "NIT o documento", "Correo", "Destino", "Cuenta o wallet", "Estado", "Monto COP", "Monto en cripto", "Referencia del envío", "Nota"]);
  for (const w of rows)
    csv += csvLine([
      formatDateTime(w.createdAt),
      w.confirmedAt ? formatDateTime(w.confirmedAt) : "",
      w.id,
      w.companyName || w.userName,
      w.fullName,
      w.customerId,
      w.userEmail,
      w.bankName ? `${w.bankName} · ${accountKindLabel(w.bankName, w.bankAccountType)}` : `Wallet${w.walletName ? ` (${w.walletName})` : ""}`,
      w.bankAccountNumber ?? w.walletAddress,
      txStatusLabel(w.status),
      w.amountCop,
      w.bankName || !w.assetAmount ? "" : `${w.assetAmount} ${w.asset}`,
      w.status === "confirmada" ? w.txHash : "",
      w.note,
    ]);
  return csv;
}
