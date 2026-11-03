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
    default:
      return "Movimiento";
  }
}

export function txDetail(t: TxDTO) {
  if (t.kind === "asignacion_demo") return "Para explorar el panel";
  if (t.kind === "venta_inmediata" || t.kind === "venta_p2p") return "Abonado a tu saldo en Solaxy";
  const parts = [t.walletName, t.assetAmount != null && t.asset && t.asset !== "COP" ? formatAsset(t.assetAmount, t.asset) : null, t.walletAddress && t.walletAddress.startsWith("0x") ? shortAddress(t.walletAddress) : null].filter(Boolean);
  return parts.join(", ");
}

/** Signo desde el punto de vista del saldo/patrimonio del usuario. */
export function txAmount(t: TxDTO) {
  if (t.kind === "venta_inmediata" || t.kind === "venta_p2p") return { text: `+${formatCop(t.amountCop)}`, tone: "text-leaf-300" };
  if (t.kind === "retiro") return { text: `−${formatCop(t.amountCop)}`, tone: "text-silver-100" };
  return { text: formatCop(t.amountCop), tone: "text-silver-100" };
}

export const STATUS_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  fallida: "Fallida",
  cancelada: "Cancelada",
};
