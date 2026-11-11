import { formatUnits } from "viem";

/**
 * Lógica pura del pago cripto directo: cotización exacta y verificación de una transacción
 * de BNB Chain contra la orden. Sin red: los datos de la cadena llegan ya leídos.
 */

export type CryptoAsset = "USDT" | "BNB";
export const CRYPTO_ASSETS: CryptoAsset[] = ["USDT", "BNB"];

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Margen para relojes y bloques: una transacción hasta 2 min "antes" de la orden se acepta. */
const CLOCK_SKEW_S = 120;
/** Tras vencer la cotización se aceptan pagos minados hasta 10 min después (red congestionada). */
const LATE_GRACE_MS = 10 * 60_000;
/** Si la transacción no aparece en la red 30 min después del vencimiento, se da por fallida. */
const NOT_FOUND_GRACE_MS = 30 * 60_000;

/**
 * Monto exacto a pagar en unidades base (wei), redondeado HACIA ARRIBA a 6 decimales,
 * para que nunca quede por debajo del valor en COP.
 */
export function quoteBaseUnits(amountCop: number, priceCop: number, decimals: number) {
  if (!(priceCop > 0) || !Number.isFinite(priceCop)) throw new Error("Precio inválido");
  const priceMicro = BigInt(Math.round(priceCop * 1e6));
  const scale = 10n ** BigInt(decimals);
  const numerator = BigInt(Math.round(amountCop)) * 1_000_000n * scale;
  const exact = (numerator + priceMicro - 1n) / priceMicro;
  const step = 10n ** BigInt(Math.max(0, decimals - 6));
  return ((exact + step - 1n) / step) * step;
}

export function formatAssetAmount(baseUnits: bigint, decimals = 18) {
  return formatUnits(baseUnits, decimals);
}

export interface ChainTx {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
}

export interface ChainLog {
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
}

export interface ChainReceipt {
  status: "success" | "reverted";
  blockNumber: bigint;
  logs: ChainLog[];
}

export interface VerifyInput {
  tx: ChainTx | null;
  receipt: ChainReceipt | null;
  latestBlock: bigint;
  /** Segundos UNIX del bloque de la transacción (si ya se minó) */
  blockTimestamp: number | null;
  order: { asset: CryptoAsset; payer: string; expectedBaseUnits: bigint; createdAt: number; expiresAt: number };
  cfg: { treasury: string; usdtContract: string; confirmations: number };
  now: number;
}

export type VerifyResult =
  | { state: "confirmada"; confirmations: number }
  | { state: "esperando"; confirmations: number }
  | { state: "fallida"; reason: string }
  | { state: "por_reembolsar"; reason: string };

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const topicAddress = (topic: string | undefined) => (topic ? `0x${topic.slice(-40)}` : "");

/** Suma de las transferencias del USDT oficial desde la wallet de la orden hacia la billetera de la empresa. */
function usdtReceived(receipt: ChainReceipt, input: VerifyInput) {
  let total = 0n;
  for (const log of receipt.logs) {
    if (!same(log.address, input.cfg.usdtContract) || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if (!same(topicAddress(log.topics[1]), input.order.payer) || !same(topicAddress(log.topics[2]), input.cfg.treasury)) continue;
    total += BigInt(log.data === "0x" ? 0 : log.data);
  }
  return total;
}

export function verifyCryptoPayment(input: VerifyInput): VerifyResult {
  const { tx, receipt, order, cfg } = input;
  const asset = order.asset;

  if (!tx) {
    return input.now > order.expiresAt + NOT_FOUND_GRACE_MS
      ? { state: "fallida", reason: "No encontramos la transacción en BNB Chain." }
      : { state: "esperando", confirmations: 0 };
  }
  if (!same(tx.from, order.payer)) return { state: "fallida", reason: "La transacción no salió de la wallet de la orden." };
  if (asset === "BNB" && !same(tx.to, cfg.treasury)) return { state: "fallida", reason: "La transacción no fue enviada a la billetera de la empresa." };
  if (!receipt) return { state: "esperando", confirmations: 0 };
  if (receipt.status !== "success") return { state: "fallida", reason: "La transacción falló en la red (revertida). No se movieron fondos." };

  if (input.blockTimestamp !== null) {
    const minedMs = input.blockTimestamp * 1000;
    if (input.blockTimestamp < Math.floor(order.createdAt / 1000) - CLOCK_SKEW_S) {
      return { state: "fallida", reason: "La transacción es anterior a la orden: no corresponde a este pago." };
    }
    if (minedMs > order.expiresAt + LATE_GRACE_MS) {
      return { state: "por_reembolsar", reason: "El pago llegó después de que venciera la cotización. Hay que devolverlo." };
    }
  }

  const received = asset === "BNB" ? tx.value : usdtReceived(receipt, input);
  if (received === 0n) {
    return { state: "fallida", reason: "No encontramos una transferencia de USDT hacia la billetera de la empresa en esta transacción." };
  }
  if (received < order.expectedBaseUnits) {
    return {
      state: "por_reembolsar",
      reason: `Monto incompleto: llegaron ${formatAssetAmount(received)} de ${formatAssetAmount(order.expectedBaseUnits)} ${asset}. Hay que devolver el pago.`,
    };
  }

  const confirmations = Number(input.latestBlock - receipt.blockNumber + 1n);
  if (confirmations < cfg.confirmations) return { state: "esperando", confirmations: Math.max(0, confirmations) };
  return { state: "confirmada", confirmations };
}
