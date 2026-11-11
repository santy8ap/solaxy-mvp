import "server-only";
import { getAddress, isAddress, zeroAddress } from "viem";

/**
 * Configuración de las pasarelas, leída de las variables de entorno en cada llamada
 * (así un cambio en Vercel aplica con el siguiente despliegue sin tocar código).
 */

export function mercadoPagoConfig() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";
  const sandbox = accessToken.startsWith("TEST-");
  return {
    enabled: sandbox || accessToken.startsWith("APP_USR-"),
    /** Con el secreto, las notificaciones sin firma válida se rechazan. */
    webhookSecret,
    accessToken,
    /** Credenciales TEST-…: checkout de pruebas. (Las cuentas de prueba usan APP_USR-…: lo dice el pago con live_mode.) */
    sandbox,
    /** MERCADOPAGO_API_BASE solo existe para las pruebas automáticas (un Mercado Pago falso). */
    apiBase: (process.env.MERCADOPAGO_API_BASE?.trim() || "https://api.mercadopago.com").replace(/\/$/, ""),
  };
}

export type CryptoNetwork = "bsc" | "bsc-testnet";

const NETWORKS = {
  bsc: {
    chainId: 56,
    name: "BNB Smart Chain",
    rpcUrl: "https://bsc-dataseed.bnbchain.org",
    explorer: "https://bscscan.com",
    usdt: "0x55d398326f99059fF775485246999027B3197955",
  },
  "bsc-testnet": {
    chainId: 97,
    name: "BNB Smart Chain Testnet",
    rpcUrl: "https://bsc-testnet-dataseed.bnbchain.org",
    explorer: "https://testnet.bscscan.com",
    // USDT de prueba del faucet de BNB Chain; se puede cambiar con USDT_CONTRACT.
    usdt: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
  },
} as const;

export function cryptoConfig() {
  const network: CryptoNetwork = process.env.CRYPTO_NETWORK?.trim() === "bsc-testnet" ? "bsc-testnet" : "bsc";
  const net = NETWORKS[network];
  const rawTreasury = process.env.CRYPTO_TREASURY_ADDRESS?.trim() ?? "";
  const treasury = isAddress(rawTreasury) && rawTreasury.toLowerCase() !== zeroAddress ? getAddress(rawTreasury) : null;
  const rawUsdt = process.env.USDT_CONTRACT?.trim() ?? "";
  const confirmations = Math.round(Number(process.env.CRYPTO_CONFIRMATIONS) || 5);
  return {
    enabled: treasury !== null,
    network,
    chainId: net.chainId,
    networkName: net.name,
    treasury,
    rpcUrl: process.env.BSC_RPC_URL?.trim() || net.rpcUrl,
    explorer: net.explorer,
    confirmations: Math.min(50, Math.max(1, confirmations)),
    usdtContract: isAddress(rawUsdt) ? getAddress(rawUsdt) : getAddress(net.usdt),
    usdtDecimals: 18,
  };
}

export type CryptoConfig = ReturnType<typeof cryptoConfig>;
