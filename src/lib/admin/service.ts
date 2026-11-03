import "server-only";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { account, adminAudit, ledgerTx, listing, plant, positionEntry, user, type AdminAction } from "@/lib/db/schema";
import { formatCop, formatKw } from "@/lib/format";
import { newId, simulatedTxHash } from "@/lib/ids";
import { MarketError, soldKw } from "@/lib/market";
import { validateSettings, type PlantSettings } from "@/lib/plant-settings";
import { earningsAt, kwOwnedAt } from "@/lib/portfolio-math";
import { getKwPosition, round1, toTxDTO } from "@/lib/portfolio";
import { invalidateSettings, readSettings } from "@/lib/settings";
import { DAY_MS } from "@/lib/sim";
import { buildCurves } from "@/lib/telemetry/service";

export interface Actor {
  id: string;
  name: string;
}

async function audit(actor: Actor, action: AdminAction, summary: string, detail?: unknown, targetUserId?: string) {
  await db.insert(adminAudit).values({
    id: newId("aud-"),
    actorUserId: actor.id,
    actorName: actor.name,
    action,
    targetUserId: targetUserId ?? null,
    summary,
    detail: detail === undefined ? null : JSON.stringify(detail),
    createdAt: Date.now(),
  });
}

export async function listAudit(limit = 50) {
  await ensureReady();
  return db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(limit);
}

/* ───────────── Usuarios ───────────── */

export type UserScope = "todos" | "reales" | "comunidad";

export async function listUsersForAdmin({ query = "", scope = "todos" }: { query?: string; scope?: UserScope } = {}) {
  const { spec, econ } = await ensureReady();
  const now = Date.now();
  const q = query.trim();
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(q ? or(like(user.name, `%${q}%`), like(user.email, `%${q}%`)) : undefined)
    .orderBy(desc(user.createdAt));
  const withAccount = new Set((await db.select({ userId: account.userId }).from(account)).map((a) => a.userId));
  const filtered = rows.filter((r) => (scope === "reales" ? withAccount.has(r.id) : scope === "comunidad" ? !withAccount.has(r.id) : true));
  const ids = filtered.map((r) => r.id);
  if (!ids.length) return [];

  const entries = await db
    .select({ userId: positionEntry.userId, kwDelta: positionEntry.kwDelta, ts: positionEntry.ts, pricePerKwCop: positionEntry.pricePerKwCop })
    .from(positionEntry)
    .where(inArray(positionEntry.userId, ids));
  const byUser = new Map<string, typeof entries>();
  for (const e of entries) byUser.set(e.userId, [...(byUser.get(e.userId) ?? []), e]);
  const { net } = await buildCurves(db, spec, [now, ...entries.map((e) => e.ts)], now, econ);

  const lastTx = await db
    .select({ userId: ledgerTx.userId, at: sql<number>`max(${ledgerTx.createdAt})` })
    .from(ledgerTx)
    .where(inArray(ledgerTx.userId, ids))
    .groupBy(ledgerTx.userId);
  const lastBy = new Map(lastTx.map((t) => [t.userId, t.at]));

  return filtered
    .map((r) => {
      const es = byUser.get(r.id) ?? [];
      return {
        id: r.id,
        name: r.name,
        email: withAccount.has(r.id) ? r.email : null,
        real: withAccount.has(r.id),
        kw: kwOwnedAt(es, now),
        investedCop: Math.round(es.reduce((s, e) => s + e.kwDelta * e.pricePerKwCop, 0)),
        earnedCop: earningsAt(es, net, now),
        lastActivity: lastBy.get(r.id) ?? null,
      };
    })
    .sort((a, b) => Number(b.real) - Number(a.real) || b.kw - a.kw);
}

export interface AdjustInput {
  userId: string;
  /** "set": nuevo total de kW; "delta": sumar (+) o restar (−) */
  mode: "set" | "delta";
  kw: number;
  /** Días hacia atrás desde los que cuenta un aumento (0 = desde ahora) */
  sinceDays: 0 | 7 | 30 | 90;
  reason: string;
}

export async function adjustUserKw(actor: Actor, input: AdjustInput) {
  const { commissionedAt, spec, econ } = await ensureReady();
  const now = Date.now();
  const [target] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, input.userId));
  if (!target) throw new MarketError("Usuario no encontrado", 404);
  const reason = input.reason.trim().slice(0, 200) || "Ajuste del administrador";

  const pos = await getKwPosition(input.userId, now);
  const deltaKw = round1(input.mode === "set" ? input.kw - pos.kw : input.kw);
  if (deltaKw === 0) throw new MarketError("El usuario ya tiene esa cantidad de kW");
  if (deltaKw < 0 && -deltaKw > pos.availableKw + 1e-9) {
    throw new MarketError(
      pos.listedKw > 0
        ? `El usuario no tiene tantos kW libres (${pos.availableKw} kW; ${pos.listedKw} kW están en ofertas del mercado)`
        : `El usuario no tiene tantos kW (${pos.kw} kW)`,
    );
  }
  if (deltaKw > 0) {
    const available = round1(spec.capacityKwp - (await soldKw()));
    if (deltaKw > available) throw new MarketError(`La planta solo tiene ${available} kW disponibles (capacidad ${spec.capacityKwp} kWp)`);
  }

  // Los aumentos pueden contar desde atrás (para ver historia de ganancias); las restas, desde ahora.
  const ts = deltaKw > 0 && input.sinceDays > 0 ? Math.max(commissionedAt + DAY_MS, now - input.sinceDays * DAY_MS) : now;
  const pricePerKw = deltaKw > 0 ? econ.pricePerKwCop : pos.kw > 0 ? Math.round(pos.investedCop / pos.kw) : econ.pricePerKwCop;
  const txId = newId("tx-");
  const note = input.sinceDays > 0 && deltaKw > 0 ? `${reason} (cuenta desde hace ${input.sinceDays} días)` : reason;
  await db.batch([
    db.insert(ledgerTx).values({
      id: txId,
      userId: input.userId,
      kind: "ajuste_admin",
      status: "confirmada",
      kw: deltaKw,
      amountCop: Math.round(Math.abs(deltaKw) * pricePerKw),
      asset: "COP",
      walletName: "Administrador",
      note,
      createdAt: now,
      confirmedAt: now,
    }),
    db.insert(positionEntry).values({ id: newId("pe-"), userId: input.userId, plantId: PLANT.id, kwDelta: deltaKw, pricePerKwCop: pricePerKw, ts, txId }),
  ]);
  await audit(
    actor,
    "ajuste_kw",
    `${deltaKw > 0 ? "Asignó" : "Quitó"} ${formatKw(Math.abs(deltaKw), 1)} a ${target.name} (${formatKw(pos.kw, 1)} → ${formatKw(pos.kw + deltaKw, 1)})`,
    { before: pos.kw, after: round1(pos.kw + deltaKw), deltaKw, sinceDays: input.sinceDays, reason },
    input.userId,
  );
  return { userId: input.userId, beforeKw: pos.kw, afterKw: round1(pos.kw + deltaKw), deltaKw };
}

/* ───────────── Retiros ───────────── */

export async function listWithdrawals() {
  await ensureReady();
  const rows = await db
    .select({ tx: ledgerTx, userName: user.name })
    .from(ledgerTx)
    .innerJoin(user, eq(user.id, ledgerTx.userId))
    .where(and(eq(ledgerTx.kind, "retiro"), inArray(ledgerTx.status, ["por_aprobar", "confirmada", "rechazada"])))
    .orderBy(desc(ledgerTx.createdAt))
    .limit(60);
  return rows.map((r) => ({ ...toTxDTO(r.tx), userId: r.tx.userId, userName: r.userName, signed: !!r.tx.signature }));
}

export async function decideWithdrawal(actor: Actor, txId: string, decision: "aprobar" | "rechazar", reason = "") {
  await ensureReady();
  const now = Date.now();
  const [tx] = await db.select().from(ledgerTx).where(and(eq(ledgerTx.id, txId), eq(ledgerTx.kind, "retiro")));
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  if (tx.status !== "por_aprobar") throw new MarketError("Este retiro ya fue revisado", 409);
  const [who] = await db.select({ name: user.name }).from(user).where(eq(user.id, tx.userId));

  if (decision === "aprobar") {
    // El saldo ya quedó apartado cuando el usuario pidió el retiro.
    const txHash = simulatedTxHash();
    const res = await db
      .update(ledgerTx)
      .set({ status: "confirmada", txHash, confirmedAt: now })
      .where(and(eq(ledgerTx.id, txId), eq(ledgerTx.status, "por_aprobar")))
      .returning();
    if (!res.length) throw new MarketError("Este retiro ya fue revisado", 409);
    await audit(actor, "aprobar_retiro", `Aprobó el retiro de ${formatCop(tx.amountCop)} de ${who?.name ?? "un usuario"}`, { txId }, tx.userId);
    return toTxDTO(res[0]);
  }

  const note = reason.trim().slice(0, 200) || "Rechazado por el administrador";
  const res = await db
    .update(ledgerTx)
    .set({ status: "rechazada", note, confirmedAt: now })
    .where(and(eq(ledgerTx.id, txId), eq(ledgerTx.status, "por_aprobar")))
    .returning();
  if (!res.length) throw new MarketError("Este retiro ya fue revisado", 409);
  await audit(actor, "rechazar_retiro", `Rechazó el retiro de ${formatCop(tx.amountCop)} de ${who?.name ?? "un usuario"}: ${note}`, { txId, reason: note }, tx.userId);
  return toTxDTO(res[0]);
}

/* ───────────── Planta ───────────── */

export async function updatePlantSettings(actor: Actor, next: PlantSettings) {
  await ensureReady();
  const current = await readSettings();
  const sold = await soldKw();
  const problem = validateSettings(next, { soldKw: sold });
  if (problem) throw new MarketError(problem);
  const now = Date.now();
  await db
    .update(plant)
    .set({
      name: next.name.trim(),
      location: next.location.trim(),
      capacityKwp: next.capacityKwp,
      pricePerKwCop: Math.round(next.pricePerKwCop),
      tariffDayCop: Math.round(next.tariffDayCop),
      tariffPeakCop: Math.round(next.tariffPeakCop),
      commissionPct: next.commissionPct,
      withdrawalApproval: next.withdrawalApproval,
      updatedAt: now,
    })
    .where(eq(plant.id, PLANT.id));
  invalidateSettings();

  const labels: Record<string, string> = {
    name: "nombre",
    location: "ubicación",
    capacityKwp: "capacidad",
    pricePerKwCop: "precio por kW",
    tariffDayCop: "tarifa de día",
    tariffPeakCop: "tarifa pico",
    commissionPct: "comisión",
    withdrawalApproval: "aprobación de retiros",
  };
  const changed = Object.keys(labels).filter((k) => current[k as keyof PlantSettings] !== next[k as keyof PlantSettings]);
  if (changed.length) {
    await audit(actor, "config_planta", `Cambió ${changed.map((k) => labels[k]).join(", ")} de la planta`, {
      before: Object.fromEntries(changed.map((k) => [k, current[k as keyof PlantSettings]])),
      after: Object.fromEntries(changed.map((k) => [k, next[k as keyof PlantSettings]])),
    });
  }
  return readSettings();
}

/* ───────────── Resumen ───────────── */

export async function adminOverview() {
  const { spec, settings } = await ensureReady();
  const sold = await soldKw();
  const [pending] = await db
    .select({ n: sql<number>`count(*)`, cop: sql<number>`coalesce(sum(${ledgerTx.amountCop}), 0)` })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.kind, "retiro"), eq(ledgerTx.status, "por_aprobar")));
  const [holders] = await db.select({ n: sql<number>`count(*)` }).from(
    db
      .select({ u: positionEntry.userId })
      .from(positionEntry)
      .groupBy(positionEntry.userId)
      .having(sql`sum(${positionEntry.kwDelta}) > 0`)
      .as("h"),
  );
  const [capital] = await db
    .select({ cop: sql<number>`coalesce(sum(${positionEntry.kwDelta} * ${positionEntry.pricePerKwCop}), 0)` })
    .from(positionEntry);
  const [offers] = await db.select({ n: sql<number>`count(*)` }).from(listing).where(eq(listing.status, "activa"));
  return {
    settings,
    capacityKwp: spec.capacityKwp,
    soldKw: sold,
    availableKw: round1(spec.capacityKwp - sold),
    investors: holders.n,
    capitalCop: Math.round(capital.cop),
    pendingWithdrawals: pending.n,
    pendingWithdrawalsCop: pending.cop,
    activeOffers: offers.n,
    recent: await listAudit(8),
  };
}
