import { MarketError } from "@/lib/errors";
import type { CryptoAsset } from "./crypto";

/**
 * Precio en vivo en COP para cotizar pagos reales. Con dinero real nunca se usan precios de
 * referencia: si CoinGecko no responde (o responde algo absurdo), no se cotiza.
 */

const IDS: Record<CryptoAsset, string> = { USDT: "tether", BNB: "binancecoin" };
/** Rangos de cordura en COP: protegen de una respuesta corrupta de la API. */
const SANE: Record<CryptoAsset, [number, number]> = { USDT: [2_000, 10_000], BNB: [100_000, 50_000_000] };
const TTL_MS = 60_000;

let cache: { at: number; prices: Record<CryptoAsset, number> } | null = null;

export function resetPriceCache() {
  cache = null;
}

export const NO_LIVE_PRICE = "No hay precio en vivo de las criptomonedas en este momento. Intenta en unos minutos o paga con tarjeta, PSE o Nequi.";

export async function liveCopPrices(deps: { fetch?: typeof fetch } = {}): Promise<Record<CryptoAsset, number> & { at: number }> {
  if (cache && Date.now() - cache.at < TTL_MS) return { ...cache.prices, at: cache.at };
  const base = (process.env.COINGECKO_API_BASE?.trim() || "https://api.coingecko.com/api/v3").replace(/\/$/, "");
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (key) headers["x-cg-demo-api-key"] = key;
  let json: Record<string, { cop?: number }>;
  try {
    const res = await (deps.fetch ?? fetch)(`${base}/simple/price?ids=${Object.values(IDS).join(",")}&vs_currencies=cop`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    json = (await res.json()) as Record<string, { cop?: number }>;
  } catch {
    throw new MarketError(NO_LIVE_PRICE, 503);
  }
  const prices = {} as Record<CryptoAsset, number>;
  for (const asset of Object.keys(IDS) as CryptoAsset[]) {
    const cop = json[IDS[asset]]?.cop;
    const [min, max] = SANE[asset];
    if (typeof cop !== "number" || !(cop >= min && cop <= max)) throw new MarketError(NO_LIVE_PRICE, 503);
    prices[asset] = cop;
  }
  cache = { at: Date.now(), prices };
  return { ...prices, at: cache.at };
}
