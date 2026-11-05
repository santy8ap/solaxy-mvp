import "server-only";

/**
 * Cómo llamar a CoinGecko: la URL base (COINGECKO_API_BASE, para pruebas) y los encabezados, con la
 * llave Demo (COINGECKO_API_KEY) si está configurada. Sin llave funciona con el límite público, que
 * desde servidores compartidos como Vercel se agota con facilidad.
 */
export function coingecko() {
  const base = (process.env.COINGECKO_API_BASE?.trim() || "https://api.coingecko.com/api/v3").replace(/\/$/, "");
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (key) headers["x-cg-demo-api-key"] = key;
  return { base, headers };
}
