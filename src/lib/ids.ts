import { BRAND } from "@/config/brand";
/** Identificadores y hashes aleatorios (criptográficamente seguros). */
export function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

/**
 * Código de orden con la sigla de la marca, p. ej. XGE-7F3A21C9B0. También es la referencia del pago en
 * Mercado Pago: debe ser única. Las órdenes de antes del cambio de marca conservan su sigla (IWE-…).
 */
export function orderCode() {
  return `${BRAND.shortName}-${randomHex(5).toUpperCase()}`;
}

/** ¿Tiene forma de código de orden? Acepta cualquier sigla de 2 a 5 letras, para las órdenes viejas. */
export const isOrderCode = (value: string) => /^[A-Z]{2,5}-[0-9A-F]{6,12}$/.test(value);

/** Hash de transacción simulado con formato EVM. */
export function simulatedTxHash() {
  return `0x${randomHex(32)}`;
}

/** Código de un plan comprado, p. ej. PLN-7F3A21C9. */
export function planCode() {
  return `PLN-${randomHex(4).toUpperCase()}`;
}
