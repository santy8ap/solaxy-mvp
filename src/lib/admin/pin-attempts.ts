import "server-only";
import type { Client } from "@libsql/client";
import { pinMatches } from "./token";

/** Intentos fallidos permitidos dentro de un minuto, y cuánto dura el bloqueo después. */
export const PIN_MAX_FAILS = 5;
export const PIN_WINDOW_MS = 60_000;
export const PIN_LOCK_MS = 60_000;

export type PinAttempt = { ok: true } | { ok: false; locked: boolean; retryAfterSec?: number };

/**
 * Verifica un PIN con límite de intentos guardado en la base (compartido entre instancias de Vercel).
 * `keys` identifica a quién se cuenta: la cuenta y la IP. Con 5 fallos en un minuto en cualquiera de
 * ellas, se bloquea un minuto, y durante el bloqueo ni siquiera el PIN correcto entra.
 */
export async function verifyPinAttempt(
  { pin, expected, keys, now = Date.now() }: { pin: string; expected: string; keys: string[]; now?: number },
  dbClient?: Client,
): Promise<PinAttempt> {
  const c = dbClient ?? (await import("@/lib/db")).client;
  const lockUntil = async (key: string) => {
    const r = await c.execute({ sql: "SELECT max(window_start) AS until FROM rate_limit WHERE rl_key = ? AND window_start > ?", args: [`pin-lock:${key}`, now] });
    return Number(r.rows[0]?.until ?? 0);
  };
  const until = Math.max(0, ...(await Promise.all(keys.map(lockUntil))));
  if (until > now) return { ok: false, locked: true, retryAfterSec: Math.ceil((until - now) / 1000) };

  if (pinMatches(pin, expected)) {
    // Un acierto borra los fallos de la cuenta (la primera clave).
    await c.execute({ sql: "DELETE FROM rate_limit WHERE rl_key = ?", args: [`pin-fail:${keys[0]}`] });
    return { ok: true };
  }

  for (const key of keys) {
    await c.execute({
      sql: `INSERT INTO rate_limit (rl_key, window_start, count) VALUES (?, ?, 1)
            ON CONFLICT(rl_key, window_start) DO UPDATE SET count = count + 1`,
      args: [`pin-fail:${key}`, now],
    });
    const r = await c.execute({ sql: "SELECT coalesce(sum(count), 0) AS n FROM rate_limit WHERE rl_key = ? AND window_start > ?", args: [`pin-fail:${key}`, now - PIN_WINDOW_MS] });
    if (Number(r.rows[0]?.n ?? 0) >= PIN_MAX_FAILS) {
      await c.execute({
        sql: "INSERT OR IGNORE INTO rate_limit (rl_key, window_start, count) VALUES (?, ?, 1)",
        args: [`pin-lock:${key}`, now + PIN_LOCK_MS],
      });
    }
  }
  return { ok: false, locked: false };
}
