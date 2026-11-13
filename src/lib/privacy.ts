import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { LEGAL } from "@/config/legal";
import { audit, type Actor } from "@/lib/admin/service";
import { alertAdmin } from "@/lib/alerts";
import { db, type DbSession } from "@/lib/db";
import { deletedEmail } from "@/lib/deleted-account";
import { writeTransaction } from "@/lib/db/transaction";
import { account, companyProfile, dataRequest, ledgerTx, paymentReview, session, user, verification, walletLink } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { formatCop, formatDate } from "@/lib/format";
import { IN_FLIGHT_MS, closeAbandonedOrders } from "@/lib/jobs/housekeeping";
import { newId } from "@/lib/ids";
import { listSubscriptions } from "@/lib/plans/service";
import { getBalance, toSubscriptionDTO } from "@/lib/portfolio";
import { safeText } from "@/lib/security/text";
import { readConfig } from "@/lib/settings";
import { DAY_MS, TZ_OFFSET_MS } from "@/lib/time";

/**
 * Derechos de los titulares sobre sus datos personales (Ley 1581 de 2012): descargar todo lo que
 * guardamos de ellos y pedir que se elimine su cuenta. Eliminar quita los datos de contacto y el acceso;
 * lo que la ley contable obliga a conservar de quien pagó (nombre, documento y movimientos) se conserva.
 */

/** Plazo para responder un reclamo: 15 días hábiles (Ley 1581, art. 15). */
export const RESPONSE_BUSINESS_DAYS = 15;

/** El final (23:59 en Colombia) del día hábil número `days` después de `from`. No descuenta festivos: el plazo queda más corto, no más largo. */
export function addBusinessDays(from: number, days: number) {
  let local = new Date(from + TZ_OFFSET_MS);
  let left = days;
  while (left > 0) {
    local = new Date(local.getTime() + DAY_MS);
    const wd = local.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 23, 59, 59);
  return end - TZ_OFFSET_MS;
}

const reasonField = safeText(500, { label: "El motivo" }).optional();
const noteField = safeText(500, { min: 8, label: "La respuesta" });

/* ───────────── Descargar mis datos ───────────── */

/** Todo lo que guardamos de una cuenta, en un JSON legible. Sin tokens de sesión ni de Google. */
export async function exportPersonalData(userId: string, now = Date.now()) {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u) throw new MarketError("Cuenta no encontrada", 404);
  const [profile] = await db.select().from(companyProfile).where(eq(companyProfile.userId, userId));
  const providers = await db.select({ providerId: account.providerId, createdAt: account.createdAt }).from(account).where(eq(account.userId, userId));
  const { solar } = await readConfig();
  const plans = (await listSubscriptions(userId)).map((s) => toSubscriptionDTO(s, solar, now));
  const movements = await db.select().from(ledgerTx).where(eq(ledgerTx.userId, userId)).orderBy(asc(ledgerTx.createdAt));
  const [wallet] = await db.select().from(walletLink).where(eq(walletLink.userId, userId));
  const requests = await db.select().from(dataRequest).where(eq(dataRequest.userId, userId)).orderBy(asc(dataRequest.createdAt));
  const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);
  return {
    generadoEl: iso(now),
    responsable: { empresa: LEGAL.company, correoParaDatosPersonales: LEGAL.email },
    cuenta: {
      id: u.id,
      nombre: u.name,
      correo: u.email,
      correoVerificado: u.emailVerified,
      creadaEl: iso(u.createdAt.getTime()),
      ingresaCon: providers.map((p) => p.providerId),
    },
    datosPersonales: profile
      ? {
          razonSocial: profile.companyName || null,
          nit: profile.nit || null,
          titular: profile.fullName,
          tipoDeDocumento: profile.docType,
          documento: profile.docNumber,
          celular: profile.phone,
          ciudad: profile.city,
          terminosAceptados: { version: profile.termsVersion, fecha: iso(profile.termsAcceptedAt) },
          actualizadoEl: iso(profile.updatedAt),
        }
      : null,
    planes: plans.map((p) => ({
      id: p.id,
      plan: p.planName,
      estado: p.state,
      mesesPagados: p.paidMonths,
      meses: p.months,
      precioCompraCopPorKwh: p.priceCopPerKwh,
      precioVentaCopPorKwh: p.saleCopPerKwh,
      energiaGeneradaKwh: Math.round(p.generatedKwh),
      periodos: p.periods.map((x) => ({ mes: x.index, desde: iso(x.startsAt), hasta: iso(x.endsAt) })),
    })),
    movimientos: movements.map((t) => ({
      id: t.id,
      tipo: t.kind === "retiro" ? "retiro" : "pago de un mes",
      estado: t.status,
      montoCop: t.amountCop,
      medio: t.method,
      fecha: iso(t.createdAt),
      confirmadoEl: iso(t.confirmedAt),
      mes: t.periodIndex,
      energiaKwh: t.kwh,
      activo: t.asset,
      cantidad: t.assetAmount,
      red: t.network,
      wallet: t.walletAddress,
      hashOComprobante: t.txHash,
      banco: t.bankName,
      tipoDeCuenta: t.bankAccountType,
      numeroDeCuenta: t.bankAccountNumber,
      nota: t.note,
    })),
    wallet: wallet ? { direccion: wallet.address, nombre: wallet.walletName, red: wallet.chainId, conectadaEl: iso(wallet.connectedAt) } : null,
    solicitudesSobreDatos: requests.map((r) => ({
      tipo: r.kind,
      estado: r.status,
      motivo: r.reason,
      pedidaEl: iso(r.createdAt),
      plazo: iso(r.dueAt),
      respondidaEl: iso(r.resolvedAt),
      respuesta: r.resolution,
    })),
  };
}

/* ───────────── Pedir la eliminación ───────────── */

export type DataRequestRow = typeof dataRequest.$inferSelect;

/** La solicitud de eliminación que sigue abierta, si la hay. */
export async function openDeletionRequest(userId: string, tx: DbSession = db): Promise<DataRequestRow | null> {
  const [row] = await tx
    .select()
    .from(dataRequest)
    .where(and(eq(dataRequest.userId, userId), eq(dataRequest.kind, "eliminacion"), eq(dataRequest.status, "pendiente")));
  return row ?? null;
}

/** La última solicitud de eliminación (abierta o ya respondida), para mostrarle al titular cómo va. */
export async function lastDeletionRequest(userId: string): Promise<DataRequestRow | null> {
  const [row] = await db
    .select()
    .from(dataRequest)
    .where(and(eq(dataRequest.userId, userId), eq(dataRequest.kind, "eliminacion")))
    .orderBy(sql`${dataRequest.createdAt} desc`)
    .limit(1);
  return row ?? null;
}

/** El titular pide que se elimine su cuenta. Si ya hay una solicitud abierta, devuelve esa. */
export async function requestDeletion(userId: string, reason?: string, now = Date.now()) {
  const why = reasonField.parse(reason?.trim() ? reason : undefined);
  const open = await openDeletionRequest(userId);
  if (open) return { request: open, created: false };
  // Dentro de una transacción de escritura: un doble clic o dos pestañas dejan una sola solicitud.
  const { row, created } = await writeTransaction(async (tx) => {
    const again = await openDeletionRequest(userId, tx);
    if (again) return { row: again, created: false };
    const [inserted] = await tx
      .insert(dataRequest)
      .values({
        id: newId("dat-"),
        userId,
        kind: "eliminacion",
        status: "pendiente",
        reason: why ?? null,
        createdAt: now,
        dueAt: addBusinessDays(now, RESPONSE_BUSINESS_DAYS),
      })
      .returning();
    return { row: inserted, created: true };
  });
  if (!created) return { request: row, created: false };
  alertAdmin(async () => {
    const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
    const [p] = await db.select({ company: companyProfile.companyName, fullName: companyProfile.fullName }).from(companyProfile).where(eq(companyProfile.userId, userId));
    const who = p?.company || p?.fullName || u?.name || "Un cliente";
    return {
      kind: "datos",
      subject: `Solicitud de eliminación de datos: ${who}`,
      lines: [
        `${who} pidió que eliminemos su cuenta y sus datos personales.${why ? ` Motivo: ${why}` : ""}`,
        `Por ley hay que responder antes del ${formatDate(row.dueAt)} (15 días hábiles). Atiéndela en Clientes.`,
      ],
      path: "/admin/clientes?estado=solicitudes",
    };
  });
  return { request: row, created: true };
}

/* ───────────── Atenderla desde el admin ───────────── */

/** Lo que impide eliminar la cuenta hoy. Vacío: se puede eliminar. */
export async function deletionBlockers(userId: string, now = Date.now()): Promise<string[]> {
  const { solar } = await readConfig();
  const plans = (await listSubscriptions(userId)).map((s) => toSubscriptionDTO(s, solar, now));
  const blockers: string[] = [];
  const live = plans.filter((p) => p.state === "activa" || p.state === "en_pausa" || p.state === "en_revision");
  if (live.length) blockers.push(`Tiene ${live.length === 1 ? "un plan vigente" : `${live.length} planes vigentes`} (${live.map((p) => p.planName).join(", ")}). Ciérralo antes, si así lo acordaron.`);
  // En curso: lo que se está verificando o espera al admin, un pago que el proveedor tiene en proceso, y lo que
  // se abrió hace menos de una hora (puede estar pagándose). Un checkout abandonado no detiene la eliminación.
  const [open] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.userId, userId),
        or(
          inArray(ledgerTx.status, ["verificando", "por_aprobar", "por_reembolsar"]),
          and(eq(ledgerTx.status, "pendiente"), or(isNotNull(ledgerTx.providerId), gte(ledgerTx.createdAt, now - IN_FLIGHT_MS))),
        ),
      ),
    );
  if (Number(open?.n ?? 0) > 0) blockers.push("Tiene pagos, retiros o reembolsos en curso.");
  const [review] = await db
    .select({ n: sql<number>`count(*)` })
    .from(paymentReview)
    .where(and(eq(paymentReview.userId, userId), isNull(paymentReview.resolvedAt)));
  if (Number(review?.n ?? 0) > 0) blockers.push("Tiene una devolución por conciliar.");
  const { balance } = await getBalance(userId, now);
  if (balance > 0) blockers.push(`Tiene ${formatCop(balance)} de saldo a su favor: debe retirarlo antes.`);
  return blockers;
}

async function requirePending(requestId: string) {
  const [row] = await db.select().from(dataRequest).where(eq(dataRequest.id, requestId));
  if (!row) throw new MarketError("Solicitud no encontrada", 404);
  if (row.status !== "pendiente") throw new MarketError("Esta solicitud ya fue respondida.", 409);
  return row;
}

/**
 * Elimina la cuenta: quita el acceso (sesiones e ingreso con Google), el correo, el celular, la ciudad y la
 * wallet conectada. Si la persona alguna vez pagó, se conservan su nombre, su documento y sus movimientos,
 * que la ley contable obliga a guardar; si nunca pagó, se borran también sus datos personales.
 */
export async function deleteAccount(actor: Actor, requestId: string, note?: string, now = Date.now()) {
  const req = await requirePending(requestId);
  const userId = req.userId;
  const blockers = await deletionBlockers(userId, now);
  if (blockers.length) throw new MarketError(`Todavía no se puede eliminar: ${blockers.join(" ")}`, 409, { blockers });
  // Lo que quedó sin pagar (un checkout abandonado, un retiro sin firmar) se cierra: una cuenta eliminada no deja nada abierto.
  await closeAbandonedOrders({ now, userId });
  const [paid] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), ne(ledgerTx.status, "pendiente"), ne(ledgerTx.status, "fallida"), ne(ledgerTx.status, "cancelada")));
  const keepsAccounting = Number(paid?.n ?? 0) > 0;
  const [before] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  const resolution =
    (note?.trim() ? `${note.trim()} ` : "") +
    (keepsAccounting
      ? "Se eliminaron el acceso, el correo, el celular, la ciudad y la wallet. Se conservan el nombre, el documento y los movimientos, que la ley contable obliga a guardar."
      : "Se eliminaron la cuenta y todos sus datos personales.");
  await writeTransaction(async (tx) => {
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));
    await tx.delete(walletLink).where(eq(walletLink.userId, userId));
    if (before?.email) await tx.delete(verification).where(eq(verification.identifier, before.email));
    await tx
      .update(user)
      .set({ name: "Cuenta eliminada", email: deletedEmail(userId), emailVerified: false, image: null, updatedAt: new Date(now) })
      .where(eq(user.id, userId));
    if (keepsAccounting) await tx.update(companyProfile).set({ phone: "", city: "", updatedAt: now }).where(eq(companyProfile.userId, userId));
    else await tx.delete(companyProfile).where(eq(companyProfile.userId, userId));
    await tx.update(ledgerTx).set({ walletAddress: null }).where(and(eq(ledgerTx.userId, userId), eq(ledgerTx.kind, "plan_mes")));
    await tx.update(dataRequest).set({ status: "atendida", resolvedAt: now, resolution }).where(eq(dataRequest.id, requestId));
  });
  await audit(actor, "eliminar_cuenta", `Eliminó la cuenta ${userId} a pedido del titular. ${keepsAccounting ? "Se conservan los datos contables." : "No tenía movimientos."}`, { requestId, keepsAccounting }, userId);
  return { userId, keepsAccounting, resolution };
}

/** Responde la solicitud sin eliminar la cuenta (por ejemplo, porque tiene un plan vigente). */
export async function answerRequest(actor: Actor, requestId: string, note: string, now = Date.now()) {
  const text = noteField.parse(note);
  const req = await requirePending(requestId);
  await db.update(dataRequest).set({ status: "respondida", resolvedAt: now, resolution: text }).where(eq(dataRequest.id, requestId));
  await audit(actor, "responder_solicitud_datos", `Respondió la solicitud de eliminación de ${req.userId} sin eliminar la cuenta: ${text}`, { requestId }, req.userId);
  return { requestId, resolution: text };
}

/** Solicitudes abiertas, para el resumen del admin. */
export async function pendingDataRequests() {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(dataRequest).where(eq(dataRequest.status, "pendiente"));
  return Number(row?.n ?? 0);
}
