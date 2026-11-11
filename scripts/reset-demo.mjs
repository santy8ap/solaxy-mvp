// Borra la base de datos local para empezar las pruebas desde cero.
// La próxima vez que abras la app se vuelve a crear, vacía.
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "data");
let removed = 0;
try {
  for (const f of readdirSync(dataDir)) {
    // iwe.db es la base actual; solaxy.db, la de la versión anterior.
    if (f.startsWith("iwe.db") || f.startsWith("solaxy.db")) {
      rmSync(path.join(dataDir, f), { force: true });
      removed++;
    }
  }
} catch {
  /* no existe la carpeta: nada que borrar */
}
console.log(removed ? "✓ Base de datos borrada. Reinicia la app: se crea de nuevo, vacía." : "No había base de datos local que borrar.");
