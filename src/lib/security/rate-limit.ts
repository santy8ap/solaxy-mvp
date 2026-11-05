/**
 * Límite de solicitudes en memoria (ventana deslizante). En Vercel cada instancia lleva su propia cuenta,
 * así que es una protección de mejor esfuerzo contra abusos, no un control contable.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return {
    /** Registra un intento. Devuelve false si la clave ya llegó al máximo dentro de la ventana. */
    hit(key: string, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      const allowed = recent.length < max;
      if (allowed) recent.push(now);
      hits.set(key, recent);
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      }
      return allowed;
    },
  };
}
