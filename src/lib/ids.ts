/** Identificadores y hashes aleatorios (criptográficamente seguros). */
export function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

/** Código corto de orden, p. ej. SLX-7F3A21 */
export function orderCode() {
  return `SLX-${randomHex(3).toUpperCase()}`;
}

/** Hash de transacción simulado con formato EVM. */
export function simulatedTxHash() {
  return `0x${randomHex(32)}`;
}
