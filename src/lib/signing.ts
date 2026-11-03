import { isAddress, verifyMessage, type Hex } from "viem";
import { BRAND } from "@/config/brand";
import { PLANT } from "@/config/plant";
import { formatAsset, formatCop, formatDateTime, formatKw } from "@/lib/format";

export interface OrderMessageInput {
  code: string;
  kw: number;
  amountCop: number;
  asset: string;
  assetAmount: number;
  network: string;
  walletAddress: string;
  createdAt: number;
}

/** Texto que el usuario firma con su wallet para confirmar la compra. */
export function buildOrderMessage(o: OrderMessageInput) {
  return [
    `${BRAND.name} — Orden de compra de energía`,
    ``,
    `Orden: ${o.code}`,
    `Energía: ${formatKw(o.kw)} de ${PLANT.name}`,
    `Total: ${formatCop(o.amountCop)} COP ≈ ${formatAsset(o.assetAmount, o.asset)}`,
    `Red: ${o.network}`,
    `Wallet: ${o.walletAddress}`,
    `Fecha: ${formatDateTime(o.createdAt)}`,
    ``,
    `Esta firma no mueve fondos: confirma tu orden en modo demo.`,
  ].join("\n");
}

export function buildWithdrawalMessage(o: { code: string; amountCop: number; walletAddress: string; createdAt: number }) {
  return [
    `${BRAND.name} — Retiro de ganancias`,
    ``,
    `Retiro: ${o.code}`,
    `Monto: ${formatCop(o.amountCop)} COP`,
    `Destino: ${o.walletAddress}`,
    `Fecha: ${formatDateTime(o.createdAt)}`,
    ``,
    `Esta firma no mueve fondos: autoriza el retiro en modo demo.`,
  ].join("\n");
}

/** Verifica que `signature` sea la firma EIP-191 de `message` hecha por `address`. */
export async function verifyWalletSignature(p: { address: string; message: string; signature: string }) {
  if (!isAddress(p.address) || !/^0x[0-9a-fA-F]+$/.test(p.signature)) return false;
  try {
    return await verifyMessage({ address: p.address, message: p.message, signature: p.signature as Hex });
  } catch {
    return false;
  }
}
