import "server-only";
import type { Client } from "@libsql/client";
import { createRateLimiter } from "./rate-limit";

/**
 * Límite de intentos guardado en la base de datos: lo comparten todas las instancias de Vercel
 * (el de memoria lleva una cuenta por instancia). Ventanas fijas; sumar y leer el contador es una
 * sola sentencia, así que dos solicitudes simultáneas no se saltan el límite.
 * Si la base falla, cuenta en memoria: un problema de la base no debe impedir pagar.
 */
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
        // Limpieza de ventanas viejas; si falla, no importa.
        await c.execute({ sql: "DELETE FROM rate_limit WHERE window_start < ?", args: [now - 2 * windowMs] }).catch(() => {});
        return count <= max;
      } catch {
        return memory.hit(rlKey, now);
      }
    },
  };
}
