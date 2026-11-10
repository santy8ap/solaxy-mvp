import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, appMeta, companyProfile, ledgerTx, planPeriod, planSubscription, session, user, walletLink } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { MP_SANDBOX_NETWORK } from "@/lib/payments/mercadopago-service";
import { readSettings } from "@/lib/settings";
import { realPaymentWhere } from "./payments";
import { audit, type Actor } from "./service";

export const RESET_PHRASE = "BORRAR DATOS DE PRUEBA";

/** Pagos que no movieron dinero: pago de prueba, Mercado Pago de pruebas o cripto en testnet. */
const testPayment = or(
  eq(ledgerTx.method, "demo"),
  and(eq(ledgerTx.method, "mercadopago"), eq(ledgerTx.network, MP_SANDBOX_NETWORK)),
  and(eq(ledgerTx.method, "crypto"), eq(ledgerTx.chainId, 97)),
);

/** Qué queda de la etapa de pruebas: la cuenta de pruebas y los movimientos que no movieron dinero. */
export async function demoDataStats() {
  await readSettings();
  const [demo] = await db.select({ id: user.id }).from(user).where(eq(user.email, env.demoEmail));
  const [test] = await db.select({ n: sql<number>`count(*)` }).from(ledgerTx).where(testPayment);
  const [real] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(and(realPaymentWhere, eq(ledgerTx.status, "confirmada")));
  const [plans] = await db.select({ n: sql<number>`count(*)` }).from(planSubscription);
  return { demoAccount: Boolean(demo), testPayments: Number(test.n), realPayments: Number(real.n), plans: Number(plans.n) };
}

export function hasDemoData(s: Awaited<ReturnType<typeof demoDataStats>>) {
  return s.demoAccount || s.testPayments > 0;
}

/**
 * Deja la base lista para cobrar de verdad: borra la cuenta de pruebas y todos los planes, periodos y
 * movimientos de la etapa de pruebas. Conserva las cuentas reales y los datos de sus empresas.
 * Solo con DEMO_MODE=false, con frase de confirmación y si todavía no hay pagos reales.
 */
export async function resetDemoData(actor: Actor, confirmation: string) {
  if (isDemoMode()) throw new MarketError("Primero desactiva el modo de pruebas (DEMO_MODE=false) y vuelve a desplegar.", 409);
  if (confirmation.trim() !== RESET_PHRASE) throw new MarketError(`Escribe ${RESET_PHRASE} para confirmar.`, 400);
  const stats = await demoDataStats();
  if (stats.realPayments > 0) {
    throw new MarketError("Ya hay pagos reales registrados, así que los movimientos no se pueden borrar de forma automática.", 409);
  }
  const demoUsers = await db.select({ id: user.id }).from(user).where(eq(user.email, env.demoEmail));
  const ids = demoUsers.map((u) => u.id);
  const [counts] = await db
    .select({ tx: sql<number>`(select count(*) from ${ledgerTx})`, plans: sql<number>`(select count(*) from ${planSubscription})` })
    .from(sql`(select 1)`);

  const ops = [db.delete(planPeriod), db.delete(planSubscription), db.delete(ledgerTx)];
  if (ids.length) {
    // Sin depender de las claves foráneas: se borra todo lo que cuelga de la cuenta de pruebas.
    ops.push(
      db.delete(session).where(inArray(session.userId, ids)) as never,
      db.delete(account).where(inArray(account.userId, ids)) as never,
      db.delete(companyProfile).where(inArray(companyProfile.userId, ids)) as never,
      db.delete(walletLink).where(inArray(walletLink.userId, ids)) as never,
      db.delete(user).where(inArray(user.id, ids)) as never,
    );
  }
  ops.push(
    db
      .insert(appMeta)
      .values({ key: "pruebas_borradas", value: String(Date.now()) })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: String(Date.now()) } }) as never,
  );
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);

  const result = { deletedUsers: ids.length, deletedTx: Number(counts.tx), deletedPlans: Number(counts.plans) };
  await audit(actor, "borrar_datos_prueba", `Borró los datos de prueba: ${result.deletedPlans} planes y ${result.deletedTx} movimientos`, result);
  return result;
}
