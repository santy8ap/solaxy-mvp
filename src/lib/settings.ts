import "server-only";
import { eq } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { plant } from "@/lib/db/schema";
import { plantDailyKwh } from "@/lib/energy/solar-day";
import { DEFAULT_SETTINGS, catalogFrom, parsePlanPrices, solarFrom, type PlantSettings } from "@/lib/plant-settings";

let cache: { at: number; value: PlantSettings } | null = null;

export function invalidateSettings() {
  cache = null;
}

/** Configuración vigente de la planta y de los planes (caché de 5 s). */
export async function readSettings(): Promise<PlantSettings> {
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  await ensureReady();
  const [row] = await db.select().from(plant).where(eq(plant.id, PLANT.id));
  const value: PlantSettings = row
    ? {
        name: row.name,
        location: row.location,
        peakKw: row.peakKw,
        saleCopPerKwh: row.saleCopPerKwh,
        planPrices: parsePlanPrices(row.planPrices),
        updatedAt: row.updatedAt ?? null,
      }
    : DEFAULT_SETTINGS;
  cache = { at: Date.now(), value };
  return value;
}

/** Configuración con lo que se deriva de ella: la curva solar, el catálogo y la energía diaria de la planta. */
export async function readConfig() {
  const settings = await readSettings();
  const solar = solarFrom(settings);
  return { settings, solar, catalog: catalogFrom(settings), plantDailyKwh: plantDailyKwh(solar) };
}

export type Config = Awaited<ReturnType<typeof readConfig>>;
