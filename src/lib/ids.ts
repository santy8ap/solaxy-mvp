/** Identificadores y hashes aleatorios (criptográficamente seguros). */
export function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

/** Código de orden, p. ej. IWE-7F3A21C9B0. También es la referencia del pago en Mercado Pago: debe ser única. */
export function orderCode() {
  return `IWE-${randomHex(5).toUpperCase()}`;
}

/** Hash de transacción simulado con formato EVM. */
export function simulatedTxHash() {
  return `0x${randomHex(32)}`;
}

/** Código de un plan comprado, p. ej. PLN-7F3A21C9. */
export function planCode() {
  return `PLN-${randomHex(4).toUpperCase()}`;
}
