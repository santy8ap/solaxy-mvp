import type { Client } from "@libsql/client";
import { MIGRATIONS } from "./migrations.generated";

/** Aplica las migraciones embebidas que falten. Es seguro llamarlo varias veces. */
export async function migrate(client: Client, { localFile = true } = {}) {
  if (localFile) {
    // Archivo local: mejor concurrencia entre lecturas (SSE) y escrituras.
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute(
    "CREATE TABLE IF NOT EXISTS __solaxy_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const { rows } = await client.execute("SELECT id FROM __solaxy_migrations");
  const done = new Set(rows.map((r) => String(r.id)));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await client.batch(
      [
        ...m.statements,
        { sql: "INSERT OR IGNORE INTO __solaxy_migrations (id, applied_at) VALUES (?, ?)", args: [m.id, Date.now()] },
      ],
      "write",
    );
  }
}
