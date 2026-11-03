// Copia las migraciones SQL de drizzle/ a un módulo TypeScript para que la app
// pueda crear su propia base de datos al arrancar (también en Vercel).
// Uso: npm run db:generate
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const migrations = files.map((file) => {
  const raw = readFileSync(path.join(dir, file), "utf8");
  const statements = raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
    // Idempotentes: si dos instancias arrancan a la vez, ninguna falla.
    .map((s) =>
      s
        .replace(/^CREATE TABLE `/, "CREATE TABLE IF NOT EXISTS `")
        .replace(/^CREATE UNIQUE INDEX `/, "CREATE UNIQUE INDEX IF NOT EXISTS `")
        .replace(/^CREATE INDEX `/, "CREATE INDEX IF NOT EXISTS `"),
    );
  return { id: file.replace(/\.sql$/, ""), statements };
});

const out = `// Archivo generado por scripts/embed-migrations.mjs — no editar a mano.
export const MIGRATIONS: { id: string; statements: string[] }[] = ${JSON.stringify(migrations, null, 2)};
`;
writeFileSync(path.join(root, "src/lib/db/migrations.generated.ts"), out);
console.log(`✓ ${migrations.length} migración(es) embebidas`);
