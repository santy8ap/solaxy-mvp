import "server-only";
import { createRateLimiter } from "./rate-limit";

const g = globalThis as unknown as { __solaxyOrderLimiter?: ReturnType<typeof createRateLimiter> };

/** Creación de órdenes de compra: 10 intentos cada 10 minutos por usuario. */
export const orderLimiter = (g.__solaxyOrderLimiter ??= createRateLimiter({ max: 10, windowMs: 10 * 60_000 }));

export const TOO_MANY_ORDERS = "Demasiados intentos de compra seguidos. Espera unos minutos e inténtalo de nuevo.";
