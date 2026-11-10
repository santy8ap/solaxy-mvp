import "server-only";
import { client, db, isLocalFileDb } from "./index";
import { migrate } from "./migrate";
import { seedPlant } from "./seed";

let ready: Promise<void> | null = null;

/**
 * Deja la base de datos lista: aplica las migraciones que falten y crea la fila de la planta.
 * Se llama en cada petición; el trabajo solo ocurre la primera vez en cada instancia.
 */
export function ensureReady(): Promise<void> {
  ready ??= initialize().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

async function initialize() {
  await migrate(client, { localFile: isLocalFileDb });
  await seedPlant(db);
}
