import type { Client } from "@libsql/client";
import { MIGRATIONS } from "./migrations.generated";

/**
 * Tabla donde se anota qué migraciones ya se aplicaron. Conserva el nombre de la marca anterior:
 * renombrarla haría que todas las migraciones se aplicaran de nuevo en las bases que ya existen.
 */
const TABLE = "__solaxy_migrations";
const LOCK_ID = "__lock";
/** Un candado más viejo que esto es de una instancia que murió a mitad de camino: se toma el relevo. */
const LOCK_STALE_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Errores que significan "esta sentencia ya se aplicó": pasa cuando una migración se repite porque
 * quedó a medias. Agregar algo que ya existe siempre se tolera; que falte algo, solo al quitar, renombrar o copiar.
 */
export function alreadyApplied(statement: string, message: string) {
  if (/duplicate column name|already exists/i.test(message)) return true;
  // "INSERT OR IGNORE … SELECT" copia datos de una tabla que la misma migración elimina después.
  // "CREATE TABLE IF NOT EXISTS … AS SELECT" archiva una tabla que la misma migración retira más adelante.
  const removes = /^(ALTER TABLE\s+\S+\s+(DROP COLUMN|RENAME TO)|DELETE FROM|DROP (TABLE|INDEX)|INSERT OR IGNORE INTO|CREATE TABLE IF NOT EXISTS\s+\S+\s+AS SELECT)/i.test(statement.trim());
  return removes && /no such (column|table|index)/i.test(message);
}

/** Solo una instancia migra a la vez: las demás esperan a que termine. */
async function withLock<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  const token = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  for (;;) {
    const res = await client.execute({ sql: `INSERT OR IGNORE INTO ${TABLE} (id, applied_at) VALUES (?, ?)`, args: [LOCK_ID, token] });
    if (res.rowsAffected > 0) break;
    const { rows } = await client.execute({ sql: `SELECT applied_at FROM ${TABLE} WHERE id = ?`, args: [LOCK_ID] });
    const heldSince = Math.floor(Number(rows[0]?.applied_at ?? 0) / 1000);
    if (rows.length && Date.now() - heldSince > LOCK_STALE_MS) {
      await client.execute({ sql: `DELETE FROM ${TABLE} WHERE id = ? AND applied_at = ?`, args: [LOCK_ID, rows[0].applied_at] });
      continue;
    }
    await sleep(400);
  }
  try {
    return await fn();
  } finally {
    await client.execute({ sql: `DELETE FROM ${TABLE} WHERE id = ? AND applied_at = ?`, args: [LOCK_ID, token] });
  }
}

/**
 * En Vercel, las vistas previas de una rama suelen usar la misma base de datos que producción.
 * Si una rama trae migraciones nuevas, aplicarlas desde su vista previa le cambiaría el esquema
 * a la versión que está publicada. Con una base propia para Preview, ALLOW_PREVIEW_MIGRATIONS=true lo permite.
 */
function previewSharesDatabase() {
  const allowed = ["true", "1", "si", "sí", "yes"].includes((process.env.ALLOW_PREVIEW_MIGRATIONS ?? "").trim().toLowerCase());
  return process.env.VERCEL_ENV === "preview" && !allowed;
}

async function appliedIds(client: Client) {
  const { rows } = await client.execute(`SELECT id FROM ${TABLE}`);
  return new Set(rows.map((r) => String(r.id)).filter((id) => id !== LOCK_ID));
}

/** Aplica las migraciones embebidas que falten. Es seguro llamarlo varias veces y desde varias instancias. */
export async function migrate(client: Client, { localFile = true } = {}) {
  if (localFile) {
    // Archivo local: mejor concurrencia entre lecturas y escrituras.
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute(`CREATE TABLE IF NOT EXISTS ${TABLE} (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`);
  const applied = await appliedIds(client);
  if (MIGRATIONS.every((m) => applied.has(m.id))) return;
  if (!localFile && previewSharesDatabase()) {
    throw new Error(
      "Esta vista previa de Vercel trae migraciones pendientes y usa una base de datos remota, que suele ser la de producción: no se aplican desde una vista previa. " +
        "Publica la rama en producción, o dale a Preview su propia base (TURSO_DATABASE_URL) y agrega ALLOW_PREVIEW_MIGRATIONS=true.",
    );
  }

  await withLock(client, async () => {
    const done = await appliedIds(client);
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      // Una sentencia a la vez: si la migración quedó a medias, lo ya aplicado se salta.
      for (const sql of m.statements) {
        try {
          await client.execute(sql);
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          if (!alreadyApplied(sql, msg)) throw err;
        }
      }
      await client.execute({ sql: `INSERT OR IGNORE INTO ${TABLE} (id, applied_at) VALUES (?, ?)`, args: [m.id, Date.now()] });
    }
  });
}
