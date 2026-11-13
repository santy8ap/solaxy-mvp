import "server-only";
import { createDbRateLimiter } from "./db-rate-limit";

/** Creación de órdenes de pago: 10 intentos cada 10 minutos por usuario, contados en la base. */
export const orderLimiter = createDbRateLimiter({ name: "ordenes", max: 10, windowMs: 10 * 60_000 });

export const TOO_MANY_ORDERS = "Demasiados intentos de compra seguidos. Espera unos minutos e inténtalo de nuevo.";

/** Consultas de estado de un pago (cada una llama a Mercado Pago o a la blockchain): 40 por minuto por usuario. */
export const syncLimiter = createDbRateLimiter({ name: "consultas", max: 40, windowMs: 60_000 });

export const TOO_MANY_SYNCS = "Demasiadas consultas seguidas. Espera un momento.";

/** Solicitudes de retiro: 10 cada 10 minutos por usuario (cada una escribe en la base y avisa al admin). */
export const withdrawalLimiter = createDbRateLimiter({ name: "retiros", max: 10, windowMs: 10 * 60_000 });

export const TOO_MANY_WITHDRAWALS = "Demasiadas solicitudes de retiro seguidas. Espera unos minutos e inténtalo de nuevo.";

/** Cambios de los datos personales: 20 cada 10 minutos por usuario. */
export const profileLimiter = createDbRateLimiter({ name: "perfil", max: 20, windowMs: 10 * 60_000 });

export const TOO_MANY_PROFILE_CHANGES = "Demasiados cambios seguidos. Espera unos minutos e inténtalo de nuevo.";

/** Descargas del historial completo: 10 cada 10 minutos por usuario. */
export const exportLimiter = createDbRateLimiter({ name: "exportaciones", max: 10, windowMs: 10 * 60_000 });

export const TOO_MANY_EXPORTS = "Ya descargaste el historial varias veces seguidas. Espera unos minutos.";
