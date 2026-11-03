export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export interface DiscoveredWallet {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  provider: Eip1193Provider;
}

export type WalletKind = "injected" | "walletconnect" | "demo";

export interface WalletState {
  status: "disconnected" | "connecting" | "connected";
  kind: WalletKind | null;
  name: string | null;
  icon: string | null;
  address: `0x${string}` | null;
  chainId: number | null;
  /** Saldo nativo formateado, si la wallet lo reporta */
  balance: string | null;
  error: string | null;
}

export const CHAINS: Record<number, { name: string; symbol: string }> = {
  1: { name: "Ethereum", symbol: "ETH" },
  56: { name: "BNB Smart Chain", symbol: "BNB" },
  97: { name: "BNB Testnet", symbol: "tBNB" },
  137: { name: "Polygon", symbol: "POL" },
  11155111: { name: "Sepolia", symbol: "ETH" },
};

export function chainName(id: number | null) {
  if (!id) return "Sin red";
  return CHAINS[id]?.name ?? `Red ${id}`;
}
