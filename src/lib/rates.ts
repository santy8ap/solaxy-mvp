import "server-only";
import { coingecko } from "@/lib/payments/coingecko";

export const ASSETS = ["USDT", "BNB", "ETH", "BTC"] as const;
export type Asset = (typeof ASSETS)[number];

export interface Rates {
  /** Precio de 1 unidad del activo en COP y USD */
  prices: Record<Asset, { cop: number; usd: number }>;
  source: "coingecko" | "referencia";
  updatedAt: number;
}

/** Valores de referencia si no hay internet (la demo nunca se queda sin precios). */
export const REFERENCE_PRICES: Rates["prices"] = {
  USDT: { cop: 4000, usd: 1 },
  BNB: { cop: 2_800_000, usd: 700 },
  ETH: { cop: 14_000_000, usd: 3500 },
  BTC: { cop: 420_000_000, usd: 105_000 },
};

const IDS: Record<Asset, string> = { USDT: "tether", BNB: "binancecoin", ETH: "ethereum", BTC: "bitcoin" };

let cache: { at: number; ttl: number; data: Rates } | null = null;

export async function getRates(): Promise<Rates> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.data;
  try {
    const { base, headers } = coingecko();
    const url = `${base}/simple/price?ids=${Object.values(IDS).join(",")}&vs_currencies=cop,usd`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), headers });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = (await res.json()) as Record<string, { cop?: number; usd?: number }>;
    const prices = { ...REFERENCE_PRICES };
    for (const asset of Object.keys(IDS) as Asset[]) {
      const p = json[IDS[asset]];
      if (p?.cop && p?.usd) prices[asset] = { cop: p.cop, usd: p.usd };
    }
    const data: Rates = { prices, source: "coingecko", updatedAt: Date.now() };
    cache = { at: Date.now(), ttl: 60_000, data };
    return data;
  } catch {
    const data: Rates = { prices: REFERENCE_PRICES, source: "referencia", updatedAt: Date.now() };
    cache = { at: Date.now(), ttl: 30_000, data };
    return data;
  }
}

