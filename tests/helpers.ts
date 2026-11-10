/**
 * Ayudas para las pruebas con base de datos. Cada archivo de prueba fija DATABASE_URL a un archivo
 * temporal ANTES de importar la app; por eso aquí todo se importa de forma perezosa.
 */
export const COMPANY = {
  companyName: "Energía Andina S.A.S.",
  nit: "900123456-8",
  fullName: "Laura Gómez",
  docType: "CC",
  docNumber: "1036123456",
  phone: "3001234567",
  city: "Medellín",
  acceptTerms: true,
};

/** Crea un usuario y, salvo que se pida lo contrario, los datos completos de su empresa. */
export async function createUser(id: string, { profile = true, name = `Empresa ${id}` } = {}) {
  const { db } = await import("@/lib/db");
  const { user } = await import("@/lib/db/schema");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
  const now = new Date();
  await db.insert(user).values({ id, name, email: `${id}@empresa.co`, emailVerified: true, createdAt: now, updatedAt: now }).onConflictDoNothing();
  if (profile) {
    const { saveProfile } = await import("@/lib/profile");
    await saveProfile(id, { ...COMPANY, companyName: name });
  }
  return id;
}

/**
 * Deja al usuario con un plan pagado (pago de prueba) cuyo primer mes empezó hace `days` días:
 * así ya tiene energía generada y saldo para retirar. Devuelve el id del plan.
 */
export async function fundUser(userId: string, { planId = "p180", days = 10 } = {}) {
  const { payWithTestPayment } = await import("@/lib/payments/test-payment");
  const { db } = await import("@/lib/db");
  const { planPeriod } = await import("@/lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const { order } = await payWithTestPayment({ userId, planId });
  const shift = days * 86_400_000;
  await db
    .update(planPeriod)
    .set({ startsAt: sql`${planPeriod.startsAt} - ${shift}`, endsAt: sql`${planPeriod.endsAt} - ${shift}` })
    .where(eq(planPeriod.txId, order.id));
  return order.subscriptionId as string;
}
