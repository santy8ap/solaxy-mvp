import "server-only";
import { createDbRateLimiter } from "./db-rate-limit";

/** Creación de órdenes de pago: 10 intentos cada 10 minutos por usuario, contados en la base. */
export const orderLimiter = createDbRateLimiter({ name: "ordenes", max: 10, windowMs: 10 * 60_000 });

export const TOO_MANY_ORDERS = "Demasiados intentos de compra seguidos. Espera unos minutos e inténtalo de nuevo.";

/** Consultas de estado de un pago (cada una llama a Mercado Pago o a la blockchain): 40 por minuto por usuario. */
export const syncLimiter = createDbRateLimiter({ name: "consultas", max: 40, windowMs: 60_000 });

export const TOO_MANY_SYNCS = "Demasiadas consultas seguidas. Espera un momento.";
