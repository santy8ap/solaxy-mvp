import "server-only";
import { eq } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { ensureTelemetry } from "@/lib/telemetry/service";
import { client, db, isLocalFileDb } from "./index";
import { migrate } from "./migrate";
import { appMeta, plant } from "./schema";
import { seed } from "./seed";

let ready: Promise<{ commissionedAt: number }> | null = null;

/**
 * Deja la base de datos lista: crea las tablas, siembra la demo (una sola vez)
 * y rellena la telemetría hasta este momento. Se llama en cada petición; el
 * trabajo pesado solo ocurre la primera vez.
 */
export async function ensureReady(now = Date.now()) {
  ready ??= initialize().catch((err) => {
    ready = null;
    throw err;
  });
  const { commissionedAt } = await ready;
  await ensureTelemetry(db, PLANT, commissionedAt, now);
  return { commissionedAt };
}

async function initialize() {
  await migrate(client, { localFile: isLocalFileDb });
  await seedOnce();
  const [row] = await db.select({ commissionedAt: plant.commissionedAt }).from(plant).where(eq(plant.id, PLANT.id));
  if (!row) throw new Error("La planta no quedó sembrada en la base de datos");
  return { commissionedAt: row.commissionedAt };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readSeedState() {
  const [m] = await db.select().from(appMeta).where(eq(appMeta.key, "seed"));
  return m?.value;
}

async function seedOnce() {
  if ((await readSeedState()) === "done") return;
  const token = `in_progress:${crypto.randomUUID()}:${Date.now()}`;
  await db.insert(appMeta).values({ key: "seed", value: token }).onConflictDoNothing();
  let state = await readSeedState();
  if (state === "done") return;

  if (state !== token) {
    // Otra instancia está sembrando: esperarla, o tomar el relevo si se quedó colgada.
    const startedAt = Number(state?.split(":")[2] ?? 0);
    for (let i = 0; i < 120 && Date.now() - startedAt < 90_000; i++) {
      await sleep(500);
      state = await readSeedState();
      if (state === "done") return;
    }
    await db.update(appMeta).set({ value: token }).where(eq(appMeta.key, "seed"));
  }

  const { commissionedAt } = await seed(db);
  await ensureTelemetry(db, PLANT, commissionedAt, Date.now());
  await db.update(appMeta).set({ value: "done" }).where(eq(appMeta.key, "seed"));
}
