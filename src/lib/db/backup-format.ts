import type { Client, InStatement } from "@libsql/client";

/**
 * El respaldo de los datos del negocio: una copia fiel de las tablas (con los nombres de columna de la base), en
 * un JSON que se puede guardar y restaurar en una base nueva. Sin dependencias del servidor: lo usan la ruta de
 * descarga del admin, el script de restauración y las pruebas.
 */
export const BACKUP_FORMAT = "x-green-energy/respaldo";
export const BACKUP_VERSION = 1;

/**
 * Las tablas que van, en un orden que respeta sus dependencias (así se restauran en ese mismo orden).
 * No van: las sesiones, las cuentas de Google (sus tokens), las verificaciones de ingreso, los límites de uso y
 * los turnos de las tareas. Al restaurar, cada persona vuelve a entrar con Google y todo eso se crea de nuevo.
 */
export const BACKUP_TABLES = [
  "user",
  "company_profile",
  "wallet_link",
  "plant",
  "service_setting",
  "app_meta",
  "plan_subscription",
  "ledger_tx",
  "plan_period",
  "payment_review",
  "data_request",
  "admin_audit",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface Backup {
  formato: typeof BACKUP_FORMAT;
  version: number;
  generadoEn: string;
  /** Las migraciones que tenía la base: la restauración exige una base con las mismas */
  migraciones: string[];
  tablas: Record<BackupTable, Record<string, unknown>[]>;
}

const BATCH = 500;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function* rowsOf(client: Pick<Client, "execute">, table: BackupTable) {
  for (let offset = 0; ; offset += BATCH) {
    const rs = await client.execute({ sql: `SELECT * FROM ${quote(table)} ORDER BY rowid LIMIT ? OFFSET ?`, args: [BATCH, offset] });
    for (const row of rs.rows) yield Object.fromEntries(rs.columns.map((c, i) => [c, row[i] ?? null]));
    if (rs.rows.length < BATCH) return;
  }
}

/**
 * El respaldo en trozos de texto que, unidos, forman el JSON: se puede enviar mientras se lee la base, sin
 * cargarlo todo en memoria.
 */
export async function* backupChunks(client: Pick<Client, "execute">, { now = Date.now(), migrations }: { now?: number; migrations: string[] }) {
  yield `{"formato":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"generadoEn":${JSON.stringify(new Date(now).toISOString())},"migraciones":${JSON.stringify(migrations)},"tablas":{`;
  for (const [t, table] of BACKUP_TABLES.entries()) {
    yield `${t ? "," : ""}${JSON.stringify(table)}:[`;
    let first = true;
    let chunk = "";
    for await (const row of rowsOf(client, table)) {
      chunk += `${first ? "" : ","}\n${JSON.stringify(row)}`;
      first = false;
      if (chunk.length > 64_000) {
        yield chunk;
        chunk = "";
      }
    }
    yield `${chunk}]`;
  }
  yield "}}\n";
}

/** Las migraciones aplicadas en una base (las del candado no cuentan). */
export async function appliedMigrations(client: Pick<Client, "execute">) {
  const { rows } = await client.execute("SELECT id FROM __solaxy_migrations WHERE id <> '__lock' ORDER BY id");
  return rows.map((r) => String(r.id));
}

/** Revisa que un JSON sea un respaldo de esta página y dice qué está mal si no lo es. */
export function parseBackup(value: unknown): Backup {
  const b = value as Partial<Backup> | null;
  if (!b || b.formato !== BACKUP_FORMAT) throw new Error("El archivo no es un respaldo de X green Energy.");
  if (b.version !== BACKUP_VERSION) throw new Error(`El respaldo es de la versión ${b.version} del formato; este programa restaura la ${BACKUP_VERSION}.`);
  if (!Array.isArray(b.migraciones) || !b.tablas || typeof b.tablas !== "object") throw new Error("El respaldo está incompleto.");
  for (const table of BACKUP_TABLES) if (!Array.isArray(b.tablas[table])) throw new Error(`Al respaldo le falta la tabla ${table}.`);
  return b as Backup;
}

/**
 * Restaura un respaldo en una base que ya tiene el esquema (las mismas migraciones) y está vacía: no mezcla
 * datos con una base en uso. Todo va en una sola transacción: o queda completo, o no queda nada.
 * La fila de la planta que crea la app al arrancar se reemplaza por la del respaldo.
 */
export async function restoreBackup(client: Client, backup: Backup) {
  const migrations = await appliedMigrations(client);
  const missing = backup.migraciones.filter((m) => !migrations.includes(m));
  if (missing.length) throw new Error(`A la base de destino le faltan migraciones del respaldo: ${missing.join(", ")}. Abre la página una vez con esa base (o corre las migraciones) y vuelve a intentarlo.`);
  for (const table of ["user", "ledger_tx", "plan_subscription"] as const) {
    const { rows } = await client.execute(`SELECT count(*) AS n FROM ${quote(table)}`);
    if (Number(rows[0]?.n ?? 0) > 0) throw new Error(`La base de destino ya tiene datos (tabla ${table}). Restaura en una base nueva.`);
  }
  const statements: InStatement[] = [{ sql: "DELETE FROM plant", args: [] }];
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows = backup.tablas[table];
    counts[table] = rows.length;
    for (const row of rows) {
      const columns = Object.keys(row);
      statements.push({
        sql: `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        args: columns.map((c) => row[c] as never),
      });
    }
  }
  await client.batch(statements, "write");
  return counts;
}
