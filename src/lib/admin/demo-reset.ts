import "server-only";
import { and, eq, inArray, isNotNull, isNull, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { account, appMeta, investorProfile, ledgerTx, listing, positionEntry, session, user, walletLink } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { audit, type Actor } from "./service";

export const RESET_PHRASE = "BORRAR DATOS DEMO";
const FAKE_EMAILS = "%@comunidad.solaxy.local";

/** Pagos con dinero real ya registrados: Wompi de producción o cripto en BNB Chain (no testnet). */
const realPayment = and(
  isNotNull(ledgerTx.providerId),
  or(and(eq(ledgerTx.method, "wompi"), or(isNull(ledgerTx.network), ne(ledgerTx.network, "Wompi (sandbox)"))), and(eq(ledgerTx.method, "crypto"), eq(ledgerTx.chainId, 56))),
);

/** Qué queda de la demostración: comunidad ficticia, cuenta demo y movimientos simulados. */
export async function demoDataStats() {
  await ensureReady();
  const [fake] = await db.select({ n: sql<number>`count(*)` }).from(user).where(like(user.email, FAKE_EMAILS));
  const [demo] = await db.select({ id: user.id }).from(user).where(eq(user.email, env.demoEmail));
  const [simulated] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(or(eq(ledgerTx.method, "demo"), eq(ledgerTx.kind, "asignacion_demo"), and(eq(ledgerTx.method, "wompi"), eq(ledgerTx.network, "Wompi (sandbox)")), and(eq(ledgerTx.method, "crypto"), eq(ledgerTx.chainId, 97))));
  const [real] = await db.select({ n: sql<number>`count(*)` }).from(ledgerTx).where(realPayment);
  return { fakeUsers: fake.n, demoAccount: Boolean(demo), simulatedTx: simulated.n, realPayments: real.n };
}

export function hasDemoData(s: Awaited<ReturnType<typeof demoDataStats>>) {
  return s.fakeUsers > 0 || s.demoAccount || s.simulatedTx > 0;
}

/**
 * Deja la base lista para cobrar de verdad: borra la comunidad ficticia, la cuenta demo y todos los
 * movimientos, posiciones y ofertas de la etapa de demostración. Conserva las cuentas reales y sus datos.
 * Solo con DEMO_MODE=false, con frase de confirmación y si todavía no hay pagos reales.
 */
export async function resetDemoData(actor: Actor, confirmation: string) {
  if (isDemoMode()) throw new MarketError("Primero desactiva el modo demo (DEMO_MODE=false) y vuelve a desplegar.", 409);
  if (confirmation.trim() !== RESET_PHRASE) throw new MarketError(`Escribe ${RESET_PHRASE} para confirmar.`, 400);
  await ensureReady();
  const [real] = await db.select({ id: ledgerTx.id }).from(ledgerTx).where(realPayment).limit(1);
  if (real) {
    throw new MarketError("Ya hay pagos reales registrados, así que no se pueden borrar los movimientos de forma automática.", 409);
  }
  const fake = await db
    .select({ id: user.id })
    .from(user)
    .where(or(like(user.email, FAKE_EMAILS), eq(user.email, env.demoEmail)));
  const ids = fake.map((u) => u.id);
  const [counts] = await db
    .select({
      tx: sql<number>`(select count(*) from ${ledgerTx})`,
      pe: sql<number>`(select count(*) from ${positionEntry})`,
      ls: sql<number>`(select count(*) from ${listing})`,
    })
    .from(sql`(select 1)`);

  const ops = [db.delete(positionEntry), db.delete(listing), db.delete(ledgerTx)];
  if (ids.length) {
    // Sin depender de las claves foráneas: se borra todo lo que cuelga de esos usuarios.
    ops.push(
      db.delete(session).where(inArray(session.userId, ids)) as never,
      db.delete(account).where(inArray(account.userId, ids)) as never,
      db.delete(investorProfile).where(inArray(investorProfile.userId, ids)) as never,
      db.delete(walletLink).where(inArray(walletLink.userId, ids)) as never,
      db.delete(user).where(inArray(user.id, ids)) as never,
    );
  }
  ops.push(
    db
      .insert(appMeta)
      .values({ key: "demo_borrada", value: String(Date.now()) })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: String(Date.now()) } }) as never,
  );
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);

  const result = { deletedUsers: ids.length, deletedTx: counts.tx, deletedPositions: counts.pe, deletedListings: counts.ls };
  await audit(actor, "borrar_datos_demo", `Borró los datos de demostración: ${ids.length} usuarios ficticios y ${counts.tx} movimientos`, result);
  return result;
}
