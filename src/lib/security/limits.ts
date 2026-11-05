import "server-only";
import { createRateLimiter } from "./rate-limit";

const g = globalThis as unknown as { __solaxyOrderLimiter?: ReturnType<typeof createRateLimiter> };

/** Creación de órdenes de compra: 10 intentos cada 10 minutos por usuario. */
export const orderLimiter = (g.__solaxyOrderLimiter ??= createRateLimiter({ max: 10, windowMs: 10 * 60_000 }));

export const TOO_MANY_ORDERS = "Demasiados intentos de compra seguidos. Espera unos minutos e inténtalo de nuevo.";

const g2 = globalThis as unknown as { __solaxySyncLimiter?: ReturnType<typeof createRateLimiter> };

/** Consultas de estado de un pago (cada una llama a Wompi o a la blockchain): 40 por minuto por usuario. */
export const syncLimiter = (g2.__solaxySyncLimiter ??= createRateLimiter({ max: 40, windowMs: 60_000 }));
