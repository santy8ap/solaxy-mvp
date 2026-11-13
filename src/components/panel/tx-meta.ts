import { formatAsset, formatNumber, shortAddress } from "@/lib/format";
import type { TxDTO } from "@/lib/portfolio";
import { paymentMethodLabel as methodName } from "@/lib/labels";
import { accountTypeLabel } from "@/lib/withdrawal-schema";

/** Hash de una transacción EVM (los comprobantes bancarios de un retiro no lo son). */
export const isEvmHash = (h: string | null | undefined): h is string => !!h && /^0x[0-9a-fA-F]{64}$/.test(h);

export function explorerTxUrl(t: Pick<TxDTO, "txHash" | "chainId">) {
  if (!isEvmHash(t.txHash)) return null;
  if (t.chainId === 97) return `https://testnet.bscscan.com/tx/${t.txHash}`;
  if (t.chainId === 56 || t.chainId == null) return `https://bscscan.com/tx/${t.txHash}`;
  return null;
}

export const methodLabel = (method: string | null): string => methodName(method) || "—";

/** El medio de un pago, avisando cuando no movió dinero real (credenciales de prueba o red de pruebas). */
export function paymentMethodLabel(t: Pick<TxDTO, "method" | "network" | "chainId" | "asset">) {
  if (t.method === "mercadopago") return /pruebas/i.test(t.network ?? "") ? "Mercado Pago (pruebas)" : "Mercado Pago";
  if (t.method === "crypto") return `Cripto${t.asset ? `, ${t.asset}` : ""}${t.chainId === 97 ? " (red de pruebas)" : ""}`;
  return methodLabel(t.method);
}

/** Qué fue el movimiento, en pocas palabras. */
export function txTitle(t: TxDTO) {
  if (t.kind === "retiro") return "Retiro";
  return t.periodIndex ? `Pago del mes ${t.periodIndex}` : "Pago de un plan";
}

/** El detalle: por dónde se pagó o a dónde va el retiro, o por qué no se completó. */
export function txDetail(t: TxDTO) {
  if ((t.status === "fallida" || t.status === "rechazada" || t.status === "por_reembolsar" || t.status === "reembolsada") && t.note) return t.note;
  if (t.kind === "retiro") {
    if (t.bankName) return `${t.bankName}, ${accountTypeLabel(t.bankAccountType).toLowerCase()} terminada en ${t.bankAccountLast4 ?? "····"}`;
    const amount = t.assetAmount != null && t.asset && t.asset !== "COP" ? `${formatAsset(t.assetAmount, t.asset)} a ` : "";
    return `${amount}${t.walletName ?? "wallet"} ${shortAddress(t.walletAddress)}`;
  }
  const parts = [paymentMethodLabel(t)];
  if (t.method === "crypto" && t.assetAmount != null && t.asset) parts.push(formatAsset(t.assetAmount, t.asset));
  if (t.kwh) parts.push(`${formatNumber(t.kwh)} kWh`);
  if (t.status === "verificando" && t.providerStatus) parts.push(t.providerStatus);
  return parts.join(", ");
}
