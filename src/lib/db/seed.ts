import "server-only";
import { eq } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { DEFAULT_SETTINGS } from "@/lib/plant-settings";
import type { Db } from "./client";
import { plant, user } from "./schema";

/** Crea la fila de la planta con los valores iniciales si no existe. No se inventan clientes ni movimientos. */
export async function seedPlant(db: Db) {
  await db
    .insert(plant)
    .values({
      id: PLANT.id,
      name: DEFAULT_SETTINGS.name,
      location: DEFAULT_SETTINGS.location,
      peakKw: DEFAULT_SETTINGS.peakKw,
      saleCopPerKwh: DEFAULT_SETTINGS.saleCopPerKwh,
      planPrices: JSON.stringify(DEFAULT_SETTINGS.planPrices),
    })
    .onConflictDoNothing();
}

/** Cuenta de pruebas (solo en modo de pruebas): se crea la primera vez que alguien entra con ella. */
export async function ensureDemoAccount(db: Db) {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, env.demoEmail));
  if (existing) return existing.id;
  const res = await auth.api.signUpEmail({ body: { name: env.demoName, email: env.demoEmail, password: env.demoPassword } });
  return res.user.id;
}
