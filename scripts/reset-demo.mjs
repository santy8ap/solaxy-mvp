// Borra la base de datos local para empezar la demo desde cero.
// La próxima vez que abras la app se vuelve a crear con los datos de ejemplo.
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "data");
let removed = 0;
try {
  for (const f of readdirSync(dataDir)) {
    if (f.startsWith("solaxy.db")) {
      rmSync(path.join(dataDir, f), { force: true });
      removed++;
    }
  }
} catch {
  /* no existe la carpeta: nada que borrar */
}
console.log(removed ? "✓ Base de datos borrada. Reinicia la app para recrear los datos de ejemplo." : "No había base de datos local que borrar.");
