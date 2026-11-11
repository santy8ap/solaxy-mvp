import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export function cronConfigured() {
  return (process.env.CRON_SECRET?.trim().length ?? 0) >= 32;
}

/** Nunca permite una invocación anónima si falta la configuración. */
export function authorizedCron(header: string | null): boolean {
  if (!cronConfigured() || !header) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(
    hash(header),
    hash(`Bearer ${process.env.CRON_SECRET!.trim()}`),
  );
}
