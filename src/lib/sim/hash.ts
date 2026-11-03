/**
 * Aleatoriedad determinista: el mismo instante siempre produce el mismo clima,
 * así el servidor, el navegador y el historial guardado coinciden.
 * Los valores deben caber en 32 bits (índices de día, de intervalo o de 2 s).
 */
export function hash32(...values: number[]): number {
  let h = 2166136261 ^ values.length;
  for (const v of values) {
    let k = v | 0;
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Número pseudoaleatorio en [0, 1). */
export function hash01(...values: number[]): number {
  return hash32(...values) / 4294967296;
}

/** Ruido suave en [0, 1): interpola valores aleatorios en los enteros de `x`. */
export function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(seed, i);
  const b = hash01(seed, i + 1);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}
