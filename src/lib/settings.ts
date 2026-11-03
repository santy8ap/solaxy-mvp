import "server-only";
import { eq } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { plant } from "@/lib/db/schema";
import { DEFAULT_SETTINGS, econFrom, specFrom, type PlantSettings } from "@/lib/plant-settings";

let cache: { at: number; value: PlantSettings } | null = null;

export function invalidateSettings() {
  cache = null;
}

/** Configuración vigente de la planta (caché de 5 s). Requiere que la BD ya exista. */
export async function readSettings(): Promise<PlantSettings> {
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  const [row] = await db.select().from(plant).where(eq(plant.id, PLANT.id));
  const value: PlantSettings = row
    ? {
        name: row.name,
        location: row.location,
        capacityKwp: row.capacityKwp,
        pricePerKwCop: row.pricePerKwCop,
        tariffDayCop: row.tariffDayCop,
        tariffPeakCop: row.tariffPeakCop,
        commissionPct: row.commissionPct,
        withdrawalApproval: row.withdrawalApproval,
        updatedAt: row.updatedAt ?? null,
      }
    : DEFAULT_SETTINGS;
  cache = { at: Date.now(), value };
  return value;
}

export async function readConfig() {
  const settings = await readSettings();
  return { settings, spec: specFrom(settings), econ: econFrom(settings) };
}

export type Config = Awaited<ReturnType<typeof readConfig>>;
