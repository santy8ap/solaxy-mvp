import { TransactionNotFoundError, TransactionReceiptNotFoundError, createPublicClient, http } from "viem";
import type { ChainReceipt, ChainTx } from "./crypto";

/** Lo único que la verificación necesita de la blockchain. Inyectable para probar sin red. */
export interface ChainReader {
  getChainId(): Promise<number>;
  getTransaction(hash: `0x${string}`): Promise<ChainTx | null>;
  getReceipt(hash: `0x${string}`): Promise<ChainReceipt | null>;
  getBlockNumber(): Promise<bigint>;
  /** Segundos UNIX del bloque */
  getBlockTimestamp(blockNumber: bigint): Promise<number>;
}

const readers = new Map<string, ChainReader>();

/** Lector por JSON-RPC (nodo público de BNB Chain o BSC_RPC_URL). */
export function rpcChainReader(rpcUrl: string): ChainReader {
  const cached = readers.get(rpcUrl);
  if (cached) return cached;
  const client = createPublicClient({ transport: http(rpcUrl, { timeout: 10_000, retryCount: 1 }) });
  const reader: ChainReader = {
    getChainId: () => client.getChainId(),
    async getTransaction(hash) {
      try {
        const t = await client.getTransaction({ hash });
        return { hash: t.hash, from: t.from, to: t.to ?? null, value: t.value };
      } catch (err) {
        if (err instanceof TransactionNotFoundError) return null;
        throw err;
      }
    },
    async getReceipt(hash) {
      try {
        const r = await client.getTransactionReceipt({ hash });
        return { status: r.status, blockNumber: r.blockNumber, logs: r.logs.map((l) => ({ address: l.address, topics: [...l.topics], data: l.data })) };
      } catch (err) {
        if (err instanceof TransactionReceiptNotFoundError) return null;
        throw err;
      }
    },
    getBlockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
    async getBlockTimestamp(blockNumber) {
      const b = await client.getBlock({ blockNumber });
      return Number(b.timestamp);
    },
  };
  readers.set(rpcUrl, reader);
  return reader;
}
