/**
 * Restaura un respaldo (Admin › Configuración › Respaldo de los datos) en una base de datos NUEVA y vacía.
 *
 *   RESTORE_DATABASE_URL=libsql://mi-base-nueva.turso.io RESTORE_AUTH_TOKEN=… npx tsx scripts/restore-backup.ts respaldo.json
 *
 * Primero crea las tablas (las mismas migraciones de la página) y luego copia los datos en una sola transacción:
 * o queda todo, o no queda nada. Se niega a escribir en una base que ya tiene datos, así que no puede pisar la
 * de producción. La URL y el token se pasan como variables de entorno para que no queden en el historial.
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { appliedMigrations, parseBackup, restoreBackup } from "../src/lib/db/backup-format";
import { migrate } from "../src/lib/db/migrate";

async function main() {
  const file = process.argv[2];
  const url = process.env.RESTORE_DATABASE_URL?.trim();
  if (!file || !url) {
    console.error("Uso: RESTORE_DATABASE_URL=libsql://… RESTORE_AUTH_TOKEN=… npx tsx scripts/restore-backup.ts respaldo.json");
    process.exit(2);
  }
  const backup = parseBackup(JSON.parse(await readFile(file, "utf8")));
  console.log(`Respaldo del ${backup.generadoEn}, con ${backup.migraciones.length} migraciones.`);
  const client = createClient({ url, authToken: process.env.RESTORE_AUTH_TOKEN?.trim() || undefined });
  try {
    await migrate(client, { localFile: url.startsWith("file:") });
    console.log(`Base de destino con ${(await appliedMigrations(client)).length} migraciones.`);
    const counts = await restoreBackup(client, backup);
    for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(18)} ${n}`);
    console.log("Listo. Apunta TURSO_DATABASE_URL y TURSO_AUTH_TOKEN a esta base en Vercel y vuelve a desplegar.");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`No se restauró nada: ${(error as Error).message}`);
  process.exit(1);
});
