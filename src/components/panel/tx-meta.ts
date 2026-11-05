import type { TxDTO } from "@/lib/portfolio";
import { formatAsset, formatCop, formatKw, shortAddress } from "@/lib/format";

export function txTitle(t: TxDTO) {
  const kw = t.kw != null ? formatKw(t.kw, t.kw % 1 === 0 ? 0 : 1) : "";
  switch (t.kind) {
    case "compra":
      return `Compra de ${kw} a la planta`;
    case "compra_p2p":
      return `Compra de ${kw} en el mercado`;
    case "venta_inmediata":
      return `Venta inmediata de ${kw}`;
    case "venta_p2p":
      return `Vendiste ${kw} en el mercado`;
    case "retiro":
      return `Retiro a ${t.walletName ?? "tu wallet"}`;
    case "asignacion_demo":
      return `Posición de demostración de ${kw}`;
    case "ajuste_admin":
      return (t.kw ?? 0) > 0 ? `El administrador te asignó ${kw}` : `El administrador ajustó tus kW (${kw})`;
    default:
      return "Movimiento";
  }
}

/** Hash de una transacción EVM (los comprobantes bancarios de un retiro no lo son). */
export const isEvmHash = (h: string | null | undefined): h is string => !!h && /^0x[0-9a-fA-F]{64}$/.test(h);

export function explorerTxUrl(t: Pick<TxDTO, "txHash" | "chainId">) {
  if (!isEvmHash(t.txHash)) return null;
  if (t.chainId === 97) return `https://testnet.bscscan.com/tx/${t.txHash}`;
  if (t.chainId === 56 || t.chainId == null) return `https://bscscan.com/tx/${t.txHash}`;
  return null;
}

export function txDetail(t: TxDTO) {
  if ((t.status === "fallida" || t.status === "por_reembolsar" || t.status === "reembolsada") && t.note) return t.note;
  if (t.status === "verificando") return `Verificando en BNB Chain${t.providerStatus ? ` · ${t.providerStatus}` : ""}`;
  if (t.method === "mercadopago") return `Pago con Mercado Pago${t.providerStatus === "pending" || t.providerStatus === "in_process" ? " · en proceso" : ""}`;
  if (t.kind === "asignacion_demo") return "Para explorar el panel";
  if (t.kind === "ajuste_admin") return t.note ?? "Ajuste del administrador";
  if (t.kind === "retiro" && t.status === "rechazada") return `Rechazado: ${t.note ?? "sin motivo"}`;
  if (t.kind === "retiro" && t.status === "por_aprobar") return "En revisión: el equipo de Solaxy enviará el dinero";
  if (t.kind === "venta_inmediata" || t.kind === "venta_p2p") return "Abonado a tu saldo en Solaxy";
  const parts = [t.walletName, t.assetAmount != null && t.asset && t.asset !== "COP" ? formatAsset(t.assetAmount, t.asset) : null, t.walletAddress && t.walletAddress.startsWith("0x") ? shortAddress(t.walletAddress) : null].filter(Boolean);
  return parts.join(", ");
}

/** Signo desde el punto de vista del saldo/patrimonio del usuario. */
export function txAmount(t: TxDTO) {
  if (t.kind === "ajuste_admin") {
    const kw = t.kw ?? 0;
    return { text: `${kw > 0 ? "+" : ""}${formatKw(kw, 1)}`, tone: kw > 0 ? "text-leaf-300" : "text-silver-100" };
  }
  if (t.kind === "retiro" && t.status === "rechazada") return { text: formatCop(t.amountCop), tone: "text-silver-500 line-through" };
  if (t.kind === "venta_inmediata" || t.kind === "venta_p2p") return { text: `+${formatCop(t.amountCop)}`, tone: "text-leaf-300" };
  if (t.kind === "retiro") return { text: `−${formatCop(t.amountCop)}`, tone: "text-silver-100" };
  return { text: formatCop(t.amountCop), tone: "text-silver-100" };
}

export const STATUS_LABEL: Record<string, string> = {
  por_aprobar: "Por aprobar",
  rechazada: "Rechazada",
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  verificando: "Verificando",
  fallida: "Fallida",
  cancelada: "Cancelada",
  por_reembolsar: "Por reembolsar",
  reembolsada: "Reembolsada",
};
