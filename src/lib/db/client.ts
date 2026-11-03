import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

/**
 * Dónde vive la base de datos:
 * - TURSO_DATABASE_URL / DATABASE_URL si están definidas (Turso u otro libSQL)
 * - en Vercel sin Turso: archivo temporal (los datos se pierden al reiniciar)
 * - en tu PC: ./data/solaxy.db (se crea solo)
 */
export function resolveDatabaseUrl(): string {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.VERCEL) return "file:/tmp/solaxy.db";
  return "file:./data/solaxy.db";
}

export function createDb(url = resolveDatabaseUrl(), authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN) {
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const client = createClient({ url, authToken: authToken || undefined });
  return { client, db: drizzle(client, { schema }) as Db, isLocalFile: url.startsWith("file:") };
}
