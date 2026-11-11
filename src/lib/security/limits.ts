import "server-only";
import { createRateLimiter } from "./rate-limit";
import { createDbRateLimiter } from "./db-rate-limit";

/** Límite en memoria (fallback si la BD aún no está lista). */
const g = globalThis as unknown as {
  __solaxyOrderLimiterMem?: ReturnType<typeof createRateLimiter>;
  __solaxySyncLimiterMem?: ReturnType<typeof createRateLimiter>;
};

/**
 * Limitadores persistentes en BD (compartidos entre instancias de Vercel).
 * Si la BD no está disponible (por ejemplo durante la primera inicialización),
 * se cae al limitador en memoria como fallback de mejor esfuerzo.
 */
export const orderLimiter = (() => {
  try {
    return createDbRateLimiter({ max: 10, windowMs: 10 * 60_000 });
  } catch {
    return (g.__solaxyOrderLimiterMem ??= createRateLimiter({ max: 10, windowMs: 10 * 60_000 }));
  }
})();

export const TOO_MANY_ORDERS = "Demasiados intentos de compra seguidos. Espera unos minutos e inténtalo de nuevo.";

const g2 = globalThis as unknown as {
  __solaxySyncLimiterMem?: ReturnType<typeof createRateLimiter>;
};

/** Consultas de estado de un pago (cada una llama a Mercado Pago o a la blockchain): 40 por minuto por usuario. */
export const syncLimiter = (() => {
  try {
    return createDbRateLimiter({ max: 40, windowMs: 60_000 });
  } catch {
    return (g2.__solaxySyncLimiterMem ??= createRateLimiter({ max: 40, windowMs: 60_000 }));
  }
})();
