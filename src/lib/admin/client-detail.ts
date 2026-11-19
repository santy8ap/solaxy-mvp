import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customerEmail, dataRequest, ledgerTx, session, user, walletLink } from "@/lib/db/schema";
import { audit, type Actor } from "./audit";
import { MarketError } from "@/lib/errors";
import { deletionBlockers } from "@/lib/privacy";
import { toTxDTO } from "@/lib/portfolio";
import { listAudit, listClients } from "./service";

/**
 * La ficha de un comercializador para el admin: lo mismo que la lista de Clientes (con los mismos cálculos de
 * saldo, así cuadra con todo lo demás) más todos sus movimientos, los correos que se le enviaron, lo que el
 * equipo hizo en su cuenta, sus solicitudes sobre datos personales y su último ingreso.
 */
export async function clientDetail(userId: string, now = Date.now()) {
  const [client] = await listClients({ userId });
  if (!client) throw new MarketError("Cliente no encontrado", 404);
  if (client.deletionRequest) client.deletionRequest.blockers = await deletionBlockers(userId, now);
  const [movements, emails, activity, requests, [logins], [wallet]] = await Promise.all([
    db.select().from(ledgerTx).where(eq(ledgerTx.userId, userId)).orderBy(desc(ledgerTx.createdAt), desc(ledgerTx.id)).limit(300),
    db.select().from(customerEmail).where(eq(customerEmail.userId, userId)).orderBy(desc(customerEmail.createdAt)).limit(100),
    listAudit(60, { targetUserId: userId }),
    db.select().from(dataRequest).where(eq(dataRequest.userId, userId)).orderBy(desc(dataRequest.createdAt)),
    db
      .select({
        last: sql<number | null>`max(${session.createdAt})`,
        active: sql<number>`coalesce(sum(case when ${session.expiresAt} > ${now} then 1 else 0 end), 0)`,
      })
      .from(session)
      .where(eq(session.userId, userId)),
    db.select().from(walletLink).where(eq(walletLink.userId, userId)),
  ]);
  return {
    client,
    lastLoginAt: logins?.last ? Number(logins.last) : null,
    activeSessions: Number(logins?.active ?? 0),
    wallet: wallet ? { address: wallet.address, walletName: wallet.walletName, chainId: wallet.chainId, connectedAt: wallet.connectedAt } : null,
    movements: movements.map((t) => ({ ...toTxDTO(t), providerId: t.providerId })),
    emails: emails.map((e) => ({ key: e.key, kind: e.kind, subject: e.subject, status: e.status, attempts: e.attempts, error: e.error, at: e.sentAt ?? e.createdAt })),
    activity: activity.map((a) => ({ id: a.id, action: a.action, summary: a.summary, actorName: a.actorName, createdAt: a.createdAt })),
    requests: requests.map((r) => ({ id: r.id, kind: r.kind, status: r.status, reason: r.reason, createdAt: r.createdAt, dueAt: r.dueAt, resolvedAt: r.resolvedAt, resolution: r.resolution })),
  };
}

export type ClientDetail = Awaited<ReturnType<typeof clientDetail>>;

/**
 * Cierra todas las sesiones abiertas de un cliente (perdió el celular, o cree que alguien entró a su cuenta): tendrá
 * que volver a ingresar con Google. Vale de inmediato, porque cada petición revisa que su sesión siga en la base.
 */
export async function closeClientSessions(actor: Actor, userId: string) {
  if (userId === actor.id) throw new MarketError("Para cerrar tu propia sesión, usa «Cerrar sesión».", 409);
  const [who] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  if (!who) throw new MarketError("Cliente no encontrado", 404);
  const now = Date.now();
  // Se borran todas (también las vencidas); se cuentan las que seguían abiertas.
  const rows = await db.delete(session).where(eq(session.userId, userId)).returning({ expiresAt: session.expiresAt });
  const closed = rows.filter((r) => r.expiresAt.getTime() > now).length;
  await audit(
    actor,
    "cerrar_sesiones",
    closed
      ? `Cerró ${closed === 1 ? "la sesión abierta" : `las ${closed} sesiones abiertas`} de ${who.name}: tendrá que volver a ingresar`
      : `Revisó las sesiones de ${who.name}: no tenía ninguna abierta`,
    { sessions: closed },
    userId,
  );
  return { closed };
}
