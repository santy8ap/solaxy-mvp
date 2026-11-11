import "server-only";
import type { Client } from "@libsql/client";
import { createRateLimiter } from "./rate-limit";

/**
 * Límite de intentos guardado en la base de datos: lo comparten todas las instancias de Vercel
 * (el de memoria lleva una cuenta por instancia). Ventanas fijas; sumar y leer el contador es una
 * sola sentencia, así que dos solicitudes simultáneas no se saltan el límite.
 * Si la base falla, cuenta en memoria: un problema de la base no debe impedir pagar.
 */
/** Ningún límite usa ventanas de más de una hora: lo de más de un día ya no cuenta para nada. */
const DAY_MS = 86_400_000;

export function createDbRateLimiter({ name, max, windowMs }: { name: string; max: number; windowMs: number }, dbClient?: Client) {
  const memory = createRateLimiter({ max, windowMs });
  const clientOf = async () => dbClient ?? (await import("@/lib/db")).client;
  return {
    /** Registra un intento. Devuelve false si la clave ya llegó al máximo dentro de la ventana. */
    async hit(key: string, now = Date.now()): Promise<boolean> {
      const windowStart = Math.floor(now / windowMs) * windowMs;
      // El nombre del límite va en la clave: dos límites distintos no se suman.
      const rlKey = `${name}:${key}`;
      try {
        const c = await clientOf();
        const res = await c.execute({
          sql: `INSERT INTO rate_limit (rl_key, window_start, count) VALUES (?, ?, 1)
                ON CONFLICT(rl_key, window_start) DO UPDATE SET count = count + 1
                RETURNING count`,
          args: [rlKey, windowStart],
        });
        const count = Number(res.rows[0]?.count ?? 1);
        // Limpieza: las ventanas viejas de este límite y cualquier fila de más de un día. Solo las suyas:
        // un límite de un minuto no puede borrar la cuenta de uno de diez. Si falla, no importa.
        const prefix = `${name}:`;
        await c
          .execute({
            sql: "DELETE FROM rate_limit WHERE (substr(rl_key, 1, ?) = ? AND window_start < ?) OR window_start < ?",
            args: [prefix.length, prefix, now - 2 * windowMs, now - DAY_MS],
          })
          .catch(() => {});
        return count <= max;
      } catch {
        return memory.hit(rlKey, now);
      }
    },
  };
}

/**
 * Almacén del límite de intentos de Better Auth (contraseñas) sobre la misma tabla: así el límite
 * también se cumple entre instancias de Vercel. Ventanas fijas de `window` segundos.
 */
export function betterAuthRateLimitStorage(dbClient?: Client) {
  const clientOf = async () => dbClient ?? (await import("@/lib/db")).client;
  return {
    async consume(key: string, rule: { window: number; max: number }) {
      const windowMs = rule.window * 1000;
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const c = await clientOf();
      const res = await c.execute({
        sql: `INSERT INTO rate_limit (rl_key, window_start, count) VALUES (?, ?, 1)
              ON CONFLICT(rl_key, window_start) DO UPDATE SET count = count + 1
              RETURNING count`,
        args: [`auth:${key}`, windowStart],
      });
      const count = Number(res.rows[0]?.count ?? 1);
      if (count <= rule.max) return { allowed: true, retryAfter: null };
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
    },
  };
}
