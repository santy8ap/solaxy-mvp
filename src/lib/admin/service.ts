import "server-only";
import { hasPersonalDetails } from "@/lib/profile-schema";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { adminAudit, companyProfile, ledgerTx, plant, planSubscription, user, type AdminAction } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { formatCop } from "@/lib/format";
import { newId, orderCode, simulatedTxHash } from "@/lib/ids";
import { fulfillOrder } from "@/lib/orders";
import { collectedWhere } from "@/lib/payments/real-money";
import { contractedDailyKwh, getSubscription, listAllSubscriptions, resolvePlanPayment, stateOf } from "@/lib/plans/service";
import { validateSettings, type PlantSettings } from "@/lib/plant-settings";
import { summarize, toSubscriptionDTO, toTxDTO } from "@/lib/portfolio";
import { TERMS_VERSION, requireCompleteProfile } from "@/lib/profile";
import { invalidateSettings, readConfig, readSettings } from "@/lib/settings";

export interface Actor {
  id: string;
  name: string;
}

export async function audit(actor: Actor, action: AdminAction, summary: string, detail?: unknown, targetUserId?: string) {
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
  await readSettings();
  // rowid desempata las acciones registradas en el mismo milisegundo: siempre la más reciente primero.
  return db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt), desc(sql`rowid`)).limit(limit);
}

/* ───────────── Clientes ───────────── */

function profileOf(p: typeof companyProfile.$inferSelect | undefined) {
  if (!p) return null;
  return {
    companyName: p.companyName,
    nit: p.nit,
    fullName: p.fullName,
    docType: p.docType,
    docNumber: p.docNumber,
    phone: p.phone,
    city: p.city,
    termsAcceptedAt: p.termsAcceptedAt,
    termsCurrent: p.termsVersion === TERMS_VERSION && p.termsAcceptedAt != null && hasPersonalDetails(p),
  };
}

/** Retiros pagados y en revisión de cada usuario. */
async function withdrawalsByUser() {
  const rows = await db
    .select({
      userId: ledgerTx.userId,
      withdrawn: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
      reserved: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then ${ledgerTx.amountCop} end), 0)`,
    })
    .from(ledgerTx)
    .where(eq(ledgerTx.kind, "retiro"))
    .groupBy(ledgerTx.userId);
  return new Map(rows.map((r) => [r.userId, { withdrawn: Number(r.withdrawn), reserved: Number(r.reserved) }]));
}

/** Los comercializadores registrados, con sus planes, su energía y su saldo. */
export async function listClients({ query = "" }: { query?: string } = {}) {
  const { solar } = await readConfig();
  const now = Date.now();
  const q = query.trim();
  const matching = q
    ? await db
        .select({ id: user.id })
        .from(user)
        .leftJoin(companyProfile, eq(companyProfile.userId, user.id))
        .where(or(like(user.name, `%${q}%`), like(user.email, `%${q}%`), like(companyProfile.fullName, `%${q}%`), like(companyProfile.docNumber, `%${q}%`), like(companyProfile.companyName, `%${q}%`), like(companyProfile.nit, `%${q}%`)))
    : null;
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(matching ? inArray(user.id, matching.length ? matching.map((m) => m.id) : [""]) : undefined)
    .orderBy(desc(user.createdAt));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const profiles = new Map((await db.select().from(companyProfile).where(inArray(companyProfile.userId, ids))).map((p) => [p.userId, p]));
  const subs = await listAllSubscriptions();
  const money = await withdrawalsByUser();

  return rows
    .map((r) => {
      const plans = subs.filter((s) => s.userId === r.id).map((s) => toSubscriptionDTO(s, solar, now));
      const totals = summarize(plans, solar, now);
      const w = money.get(r.id) ?? { withdrawn: 0, reserved: 0 };
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: r.createdAt.getTime(),
        profile: profileOf(profiles.get(r.id)),
        plans,
        generatedKwh: totals.generatedKwh,
        soldCop: Math.floor(totals.soldCop),
        profitCop: Math.floor(totals.profitCop),
        withdrawnCop: w.withdrawn,
        reservedCop: w.reserved,
        balanceCop: Math.max(0, Math.floor(totals.soldCop) - w.withdrawn - w.reserved),
      };
    })
    .sort((a, b) => b.plans.length - a.plans.length || b.createdAt - a.createdAt);
}

/**
 * Registra un pago que llegó por fuera de la plataforma (por ejemplo, una transferencia bancaria)
 * y activa el mes. La referencia del comprobante no puede usarse dos veces.
 */
export async function registerManualPayment(actor: Actor, input: { userId: string; planId?: string; subscriptionId?: string; reference: string }) {
  const reference = input.reference.trim().slice(0, 120);
  if (reference.length < 4) throw new MarketError("Escribe la referencia del pago: el número del comprobante o de la transferencia.");
  const [target] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, input.userId));
  if (!target) throw new MarketError("Cliente no encontrado", 404);
  const profile = await requireCompleteProfile(input.userId).catch(() => {
    throw new MarketError("Este comercializador todavía no completa sus datos personales ni acepta los términos. Pídele que lo haga antes de registrar el pago.", 412);
  });
  const now = Date.now();
  const p = await resolvePlanPayment(input.userId, { planId: input.planId, subscriptionId: input.subscriptionId }, now);
  const orderId = orderCode();
  try {
    await db.insert(ledgerTx).values({
      id: orderId,
      userId: input.userId,
      kind: "plan_mes",
      status: "pendiente",
      amountCop: p.amountCop,
      asset: "COP",
      walletName: "Transferencia bancaria",
      createdAt: now,
      method: "manual",
      providerId: reference,
      subscriptionId: p.subscriptionId,
      periodIndex: p.periodIndex,
      kwh: p.kwh,
    });
  } catch (err) {
    if (/UNIQUE/i.test(String((err as Error)?.message ?? err) + String((err as { cause?: unknown })?.cause ?? ""))) {
      throw new MarketError("Esa referencia ya se registró para otro pago.", 409);
    }
    throw err;
  }
  const r = await fulfillOrder(orderId, { providerStatus: "registrado por el administrador" }, { now });
  if (r.outcome !== "confirmada") throw new MarketError(r.order.note ?? "No se pudo activar el plan.", 409);
  await audit(
    actor,
    "pago_manual",
    `Registró el pago de ${formatCop(p.amountCop)} de ${profile.companyName || profile.fullName}: ${p.planName}, mes ${p.periodIndex} de ${p.months} (ref. ${reference})`,
    { orderId, subscriptionId: p.subscriptionId, periodIndex: p.periodIndex, amountCop: p.amountCop, reference },
    input.userId,
  );
  return toTxDTO(r.order);
}

/** Cierra un plan antes de tiempo (por ejemplo, si su pago fue devuelto): deja de generar energía y libera el cupo. */
export async function closeSubscription(actor: Actor, subscriptionId: string, reasonInput: string) {
  const reason = reasonInput.trim().slice(0, 200);
  if (reason.length < 4) throw new MarketError("Escribe el motivo del cierre.");
  const sub = await getSubscription(subscriptionId);
  if (!sub || !sub.periods.length) throw new MarketError("Plan no encontrado", 404);
  const now = Date.now();
  const state = stateOf(sub, now);
  if (state !== "activa" && state !== "en_pausa") throw new MarketError("Este plan ya terminó o ya estaba cerrado.", 409);
  const res = await db
    .update(planSubscription)
    .set({ cancelledAt: now })
    .where(and(eq(planSubscription.id, subscriptionId), sql`${planSubscription.cancelledAt} IS NULL`))
    .returning({ id: planSubscription.id });
  if (!res.length) throw new MarketError("Este plan ya estaba cerrado.", 409);
  const [who] = await db.select({ name: user.name }).from(user).where(eq(user.id, sub.userId));
  await audit(actor, "cerrar_plan", `Cerró el ${sub.planName} (${sub.id}) de ${who?.name ?? "un cliente"}: ${reason}`, { subscriptionId, reason, paidMonths: sub.periods.length }, sub.userId);
  return { id: subscriptionId, cancelledAt: now };
}

/* ───────────── Retiros ───────────── */

export async function listWithdrawals() {
  await readSettings();
  const rows = await db
    .select({ tx: ledgerTx, userName: user.name, userEmail: user.email, fullName: companyProfile.fullName, companyName: companyProfile.companyName, nit: companyProfile.nit })
    .from(ledgerTx)
    .innerJoin(user, eq(user.id, ledgerTx.userId))
    .leftJoin(companyProfile, eq(companyProfile.userId, ledgerTx.userId))
    .where(and(eq(ledgerTx.kind, "retiro"), inArray(ledgerTx.status, ["por_aprobar", "confirmada", "rechazada"])))
    .orderBy(desc(ledgerTx.createdAt))
    .limit(100);
  return rows.map((r) => ({
    ...toTxDTO(r.tx),
    userId: r.tx.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    fullName: r.fullName ?? null,
    companyName: r.companyName ?? null,
    nit: r.nit ?? null,
    // Quien paga necesita la cuenta completa (el usuario solo ve los últimos 4 dígitos).
    bankAccountNumber: r.tx.bankAccountNumber ?? null,
    signed: !!r.tx.signature,
  }));
}

/**
 * Aprueba o rechaza un retiro. Con dinero real, aprobar exige la referencia del envío que hizo el admin
 * (número del comprobante bancario o hash de la transacción); en modo de pruebas se genera una simulada.
 */
export async function decideWithdrawal(actor: Actor, txId: string, decision: "aprobar" | "rechazar", reason = "", reference = "") {
  const now = Date.now();
  const [tx] = await db.select().from(ledgerTx).where(and(eq(ledgerTx.id, txId), eq(ledgerTx.kind, "retiro")));
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  if (tx.status !== "por_aprobar") throw new MarketError("Este retiro ya fue revisado", 409);
  const [who] = await db.select({ name: user.name }).from(user).where(eq(user.id, tx.userId));

  if (decision === "aprobar") {
    // El saldo ya quedó apartado cuando el usuario pidió el retiro.
    const ref = reference.trim().slice(0, 120);
    if (!isDemoMode() && ref.length < 6) {
      throw new MarketError("Escribe la referencia del envío: el número del comprobante bancario o el hash de la transacción.");
    }
    const txHash = ref || simulatedTxHash();
    const res = await db
      .update(ledgerTx)
      .set({ status: "confirmada", txHash, confirmedAt: now })
      .where(and(eq(ledgerTx.id, txId), eq(ledgerTx.status, "por_aprobar")))
      .returning();
    if (!res.length) throw new MarketError("Este retiro ya fue revisado", 409);
    await audit(actor, "aprobar_retiro", `Aprobó el retiro de ${formatCop(tx.amountCop)} de ${who?.name ?? "un cliente"}`, { txId, referencia: txHash }, tx.userId);
    return toTxDTO(res[0]);
  }

  const note = reason.trim().slice(0, 200) || "Rechazado por el administrador";
  const res = await db
    .update(ledgerTx)
    .set({ status: "rechazada", note, confirmedAt: now })
    .where(and(eq(ledgerTx.id, txId), eq(ledgerTx.status, "por_aprobar")))
    .returning();
  if (!res.length) throw new MarketError("Este retiro ya fue revisado", 409);
  await audit(actor, "rechazar_retiro", `Rechazó el retiro de ${formatCop(tx.amountCop)} de ${who?.name ?? "un cliente"}: ${note}`, { txId, reason: note }, tx.userId);
  return toTxDTO(res[0]);
}

/* ───────────── Planta y planes ───────────── */

const SETTING_LABELS: Record<string, string> = {
  name: "nombre",
  location: "ubicación",
  peakKw: "potencia máxima",
  saleCopPerKwh: "precio de venta",
  planPrices: "precios de los planes",
};

export async function updatePlantSettings(actor: Actor, next: PlantSettings) {
  const current = await readSettings();
  const problem = validateSettings(next, { contractedDailyKwh: await contractedDailyKwh() });
  if (problem) throw new MarketError(problem);
  await db
    .update(plant)
    .set({
      name: next.name.trim(),
      location: next.location.trim(),
      peakKw: next.peakKw,
      saleCopPerKwh: next.saleCopPerKwh,
      planPrices: JSON.stringify(next.planPrices),
      updatedAt: Date.now(),
    })
    .where(eq(plant.id, PLANT.id));
  invalidateSettings();

  const same = (k: string) => JSON.stringify(current[k as keyof PlantSettings]) === JSON.stringify(next[k as keyof PlantSettings]);
  const changed = Object.keys(SETTING_LABELS).filter((k) => !same(k));
  if (changed.length) {
    await audit(actor, "config_planta", `Cambió ${changed.map((k) => SETTING_LABELS[k]).join(", ")}`, {
      before: Object.fromEntries(changed.map((k) => [k, current[k as keyof PlantSettings]])),
      after: Object.fromEntries(changed.map((k) => [k, next[k as keyof PlantSettings]])),
    });
  }
  return readSettings();
}

/* ───────────── Resumen ───────────── */

export async function adminOverview() {
  const { settings, solar, plantDailyKwh } = await readConfig();
  const now = Date.now();
  const subs = await listAllSubscriptions();
  const plans = subs.map((s) => toSubscriptionDTO(s, solar, now));
  const live = plans.filter((p) => p.state === "activa" || p.state === "en_pausa");
  const totals = summarize(plans, solar, now);
  const contracted = live.reduce((s, p) => s + p.dailyKwh, 0);
  const [w] = await db
    .select({
      pending: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then 1 else 0 end), 0)`,
      pendingCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then ${ledgerTx.amountCop} end), 0)`,
      paidCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
    })
    .from(ledgerTx)
    .where(eq(ledgerTx.kind, "retiro"));
  const [p] = await db
    .select({
      collectedCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
      toRefund: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_reembolsar' then 1 else 0 end), 0)`,
    })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.kind, "plan_mes"), collectedWhere()));
  const paidOut = Number(w?.paidCop ?? 0);
  return {
    settings,
    plantDailyKwh,
    contractedDailyKwh: contracted,
    availableDailyKwh: Math.max(0, plantDailyKwh - contracted),
    activePlans: plans.filter((x) => x.state === "activa").length,
    pausedPlans: plans.filter((x) => x.state === "en_pausa").length,
    clients: new Set(live.map((x) => subs.find((s) => s.id === x.id)?.userId)).size,
    /** Mensualidades cobradas. Incluye los pagos de prueba solo mientras el modo de pruebas está activo. */
    collectedCop: Number(p?.collectedCop ?? 0),
    generatedKwh: totals.generatedKwh,
    soldCop: Math.floor(totals.soldCop),
    /** Lo que la empresa les debe a sus clientes: venta acumulada menos lo ya pagado */
    owedCop: Math.max(0, Math.floor(totals.soldCop) - paidOut),
    paidOutCop: paidOut,
    pendingWithdrawals: Number(w?.pending ?? 0),
    pendingWithdrawalsCop: Number(w?.pendingCop ?? 0),
    paymentsToRefund: Number(p?.toRefund ?? 0),
    recent: await listAudit(8),
  };
}
