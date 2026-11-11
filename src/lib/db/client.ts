import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { databaseTarget } from "./target";

export type Db = LibSQLDatabase<typeof schema>;
/** Operaciones compartidas por la conexión y una transacción de libSQL. */
export type DbSession = Pick<Db, "select" | "insert" | "update" | "run">;

/** La URL de la base de esta ejecución (ver lib/db/target). */
export function resolveDatabaseUrl(): string {
  return databaseTarget().url;
}

/** Sin argumentos se conecta a la base de esta ejecución; con una URL, a esa (las pruebas usan archivos temporales). */
export function createDb(url?: string, authToken?: string) {
  const target = url ? { url, authToken } : databaseTarget();
  if (target.url.startsWith("file:")) {
    const file = target.url.slice("file:".length);
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const client = createClient({ url: target.url, authToken: target.authToken || undefined });
  return {
    client,
    db: drizzle(client, { schema }) as Db,
    isLocalFile: target.url.startsWith("file:"),
  };
}
