/** Formatos colombianos (es-CO). Sirven en el servidor y en el navegador. */
const nf = (min: number, max: number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: min, maximumFractionDigits: max });

const cache = new Map<string, Intl.NumberFormat>();
function fmt(min: number, max: number) {
  const key = `${min}:${max}`;
  let f = cache.get(key);
  if (!f) {
    f = nf(min, max);
    cache.set(key, f);
  }
  return f;
}

export function formatNumber(n: number, decimals = 0) {
  return fmt(decimals, decimals).format(n);
}

/** $ 1.234.567 (o con decimales) */
export function formatCop(n: number, decimals = 0) {
  const sign = n < 0 ? "−" : "";
  return `${sign}$ ${fmt(decimals, decimals).format(Math.abs(n))}`;
}

/** $ 1,2 M · $ 350 mil — para ejes y tarjetas compactas */
export function formatCopCompact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `$ ${fmt(0, 1).format(n / 1e9)} mil millones`;
  if (a >= 1e6) return `$ ${fmt(0, 1).format(n / 1e6)} M`;
  if (a >= 1e3) return `$ ${fmt(0, 0).format(n / 1e3)} mil`;
  return `$ ${fmt(0, 0).format(n)}`;
}

export function formatKw(n: number, decimals = 2) {
  return `${fmt(decimals, decimals).format(n)} kW`;
}

export function formatKwh(n: number, decimals = 0) {
  if (Math.abs(n) >= 1e6) return `${fmt(0, 2).format(n / 1e6)} GWh`;
  if (Math.abs(n) >= 1e4) return `${fmt(0, 1).format(n / 1e3)} MWh`;
  return `${fmt(decimals, decimals).format(n)} kWh`;
}

export function formatPct(fraction: number, decimals = 1) {
  return `${fmt(decimals, decimals).format(fraction * 100)} %`;
}

export function formatAsset(amount: number, asset: string) {
  const decimals = asset === "BTC" ? 6 : asset === "ETH" || asset === "BNB" ? 4 : 2;
  return `${fmt(decimals, decimals).format(amount)} ${asset}`;
}

const dt = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const dOnly = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const tOnly = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true });
const tSec = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export const formatDateTime = (ts: number) => dt.format(ts);
export const formatDay = (ts: number) => dOnly.format(ts);
export const formatTime = (ts: number) => tOnly.format(ts);
export const formatClock = (ts: number) => tSec.format(ts);

/** Hora redonda para ejes: "6 a. m.", "12 m.", "3 p. m." */
export function formatHourLabel(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  if (h === 12) return "12 m.";
  if (h === 0) return "12 a. m.";
  return h < 12 ? `${h} a. m.` : `${h - 12} p. m.`;
}

export function shortAddress(addr?: string | null) {
  if (!addr) return "—";
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}
