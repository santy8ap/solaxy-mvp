import "server-only";
import type { Client } from "@libsql/client";
import { client as defaultClient } from "@/lib/db";

export interface DbRateLimiterOptions {
  max: number;
  windowMs: number;
}

/**
 * Rate limiter persistente en SQLite (funciona entre instancias de Vercel).
 *
 * Usa ventanas fijas con contadores atómicos en la tabla `rate_limit`.
 * A diferencia del limitador en memoria (`rate-limit.ts`), este se comparte
 * entre todas las instancias de una misma base de datos, por lo que es válido
 * para despliegues serverless con múltiples instancias (Vercel, Turso, etc.).
 *
 * El incremento y la lectura del contador se hacen en una sola sentencia
 * (`INSERT ... ON CONFLICT ... RETURNING`), así que el valor es siempre
 * consistente aunque lleguen peticiones concurrentes.
 */
export function createDbRateLimiter(
  { max, windowMs }: DbRateLimiterOptions,
  dbClient: Client = defaultClient,
) {
  return {
    /** Registra un intento. Devuelve false si la clave ya llegó al máximo dentro de la ventana. */
    async hit(rlKey: string, now = Date.now()): Promise<boolean> {
      const windowStart = Math.floor(now / windowMs) * windowMs;

      // Incremento atómico con lectura del nuevo valor en una sola sentencia.
      const result = await dbClient.execute(
        `INSERT INTO rate_limit (rl_key, window_start, count)
         VALUES (?, ?, 1)
         ON CONFLICT(rl_key, window_start) DO UPDATE SET count = count + 1
         RETURNING count`,
        [rlKey, windowStart],
      );

      const count = Number(result.rows[0]?.count ?? 1);

      // Limpieza de ventanas expiradas (best effort, no bloquea).
      const cutoff = now - windowMs * 2;
      await dbClient.execute(`DELETE FROM rate_limit WHERE window_start < ?`, [cutoff]).catch(() => {
        /* ignora errores de limpieza */
      });

      return count <= max;
    },
  };
}