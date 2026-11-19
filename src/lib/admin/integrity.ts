import "server-only";
import { sql } from "drizzle-orm";
import { alertAdmin, alertMessages } from "@/lib/alerts";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { formatCop, formatNumber } from "@/lib/format";
import { claimInterval } from "@/lib/jobs/claim";
import { contractedDailyKwh, listAllSubscriptions } from "@/lib/plans/service";
import { toSubscriptionDTO } from "@/lib/portfolio";
import { readConfig } from "@/lib/settings";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { soldByUser, withdrawalsByUser } from "./service";

/**
 * El cuadre: revisa sobre los datos reales las reglas del dinero que las pruebas cubren en el código.
 * Un «error» no debería pasar nunca: si aparece, hay que revisar ese caso. Un «aviso» es algo pendiente
 * que ya lleva demasiado tiempo esperando al equipo.
 */
export type CheckLevel = "error" | "aviso";

export interface CheckItem {
  label: string;
  /** Dónde se atiende en el admin */
  href: string;
}

export interface IntegrityCheck {
  id: string;
  level: CheckLevel;
  title: string;
  ok: boolean;
  count: number;
  detail: string;
  items: CheckItem[];
}

export interface IntegrityReport {
  checkedAt: number;
  checks: IntegrityCheck[];
  errors: number;
  warnings: number;
}

export const STALE_WITHDRAWAL_MS = 3 * DAY_MS;
export const STALE_TRANSFER_MS = 3 * DAY_MS;
export const STALE_REVIEW_MS = 7 * DAY_MS;
/** Cuántos casos se muestran de cada revisión (el total va en `count`). */
const SHOWN = 8;

const ficha = (userId: string) => `/admin/clientes/${encodeURIComponent(userId)}`;
const pagos = (id: string) => `/admin/pagos?q=${encodeURIComponent(id)}`;

function result(
  id: string,
  level: CheckLevel,
  title: string,
  rows: readonly unknown[],
  okDetail: string,
  problem: (n: number) => string,
  items: CheckItem[],
): IntegrityCheck {
  return { id, level, title, ok: rows.length === 0, count: rows.length, detail: rows.length ? problem(rows.length) : okDetail, items: items.slice(0, SHOWN) };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export async function checkIntegrity(now = Date.now()): Promise<IntegrityReport> {
  await ensureReady();
  type Person = { userId: string; name: string };
  const [paidWithoutMonth, monthWithoutPayment, overlapping, staleWithdrawals, staleTransfers, staleReviews, reviewing] = await Promise.all([
    db.all<Person & { id: string; amountCop: number }>(sql`
      SELECT t.id AS id, t.user_id AS userId, u.name AS name, t.amount_cop AS amountCop
      FROM ledger_tx t JOIN \`user\` u ON u.id = t.user_id
      LEFT JOIN plan_period p ON p.tx_id = t.id
      WHERE t.kind = 'plan_mes' AND t.status = 'confirmada' AND p.id IS NULL
      ORDER BY t.created_at DESC`),
    // Un mes con energía cuyo pago no está confirmado. La excepción es una devolución ya registrada (payment_review),
    // que corta la energía de ese mes y queda por conciliar.
    db.all<Person & { txId: string; idx: number }>(sql`
      SELECT p.tx_id AS txId, p.idx AS idx, s.user_id AS userId, u.name AS name
      FROM plan_period p
      JOIN plan_subscription s ON s.id = p.subscription_id
      JOIN \`user\` u ON u.id = s.user_id
      LEFT JOIN ledger_tx t ON t.id = p.tx_id
      LEFT JOIN payment_review r ON r.payment_id = p.tx_id
      WHERE (t.id IS NULL OR t.status <> 'confirmada') AND r.payment_id IS NULL
      ORDER BY p.created_at DESC`),
    db.all<Person & { subscriptionId: string; first: number; second: number }>(sql`
      SELECT a.subscription_id AS subscriptionId, a.idx AS first, b.idx AS second, s.user_id AS userId, u.name AS name
      FROM plan_period a
      JOIN plan_period b ON b.subscription_id = a.subscription_id AND b.idx > a.idx AND b.starts_at < a.ends_at
      JOIN plan_subscription s ON s.id = a.subscription_id
      JOIN \`user\` u ON u.id = s.user_id
      ORDER BY a.created_at DESC`),
    db.all<Person & { id: string; amountCop: number; createdAt: number }>(sql`
      SELECT t.id AS id, t.user_id AS userId, u.name AS name, t.amount_cop AS amountCop, t.created_at AS createdAt
      FROM ledger_tx t JOIN \`user\` u ON u.id = t.user_id
      WHERE t.kind = 'retiro' AND t.status = 'por_aprobar' AND t.created_at < ${now - STALE_WITHDRAWAL_MS}
      ORDER BY t.created_at`),
    db.all<Person & { id: string; amountCop: number }>(sql`
      SELECT t.id AS id, t.user_id AS userId, u.name AS name, t.amount_cop AS amountCop
      FROM ledger_tx t JOIN \`user\` u ON u.id = t.user_id
      WHERE t.kind = 'plan_mes' AND t.method = 'transferencia' AND t.status = 'verificando'
        AND t.created_at < ${now - STALE_TRANSFER_MS}
      ORDER BY t.created_at`),
    db.all<Person & { paymentId: string }>(sql`
      SELECT r.payment_id AS paymentId, r.user_id AS userId, u.name AS name
      FROM payment_review r JOIN \`user\` u ON u.id = r.user_id
      WHERE r.resolved_at IS NULL AND r.occurred_at < ${now - STALE_REVIEW_MS}
      ORDER BY r.occurred_at`),
    db.all<{ userId: string }>(sql`SELECT DISTINCT user_id AS userId FROM payment_review WHERE resolved_at IS NULL`),
  ]);

  // Saldos: con los mismos cálculos del Resumen y de Clientes. Una cuenta con una devolución por conciliar puede
  // quedar en negativo y ya está marcada en Pagos; las demás nunca deberían.
  const { solar, plantDailyKwh } = await readConfig();
  const subs = await listAllSubscriptions();
  const sold = soldByUser(subs, subs.map((s) => toSubscriptionDTO(s, solar, now)), solar, now);
  const underReview = new Set(reviewing.map((r) => r.userId));
  const shortBy = [...(await withdrawalsByUser())]
    .map(([userId, m]) => ({ userId, deficit: m.withdrawn + m.reserved - (sold.get(userId) ?? 0) }))
    .filter((r) => r.deficit > 0 && !underReview.has(r.userId));
  const names = shortBy.length
    ? new Map(
        (
          await db.all<Person>(sql`SELECT id AS userId, name FROM \`user\` WHERE id IN (${sql.join(
            shortBy.map((r) => sql`${r.userId}`),
            sql`, `,
          )})`)
        ).map((r) => [r.userId, r.name]),
      )
    : new Map<string, string>();
  const contracted = await contractedDailyKwh(now);
  const oversold = contracted > plantDailyKwh + 0.5 ? [contracted] : [];

  const checks: IntegrityCheck[] = [
    result(
      "pago-sin-mes",
      "error",
      "Cada pago confirmado activó su mes",
      paidWithoutMonth,
      "Todos los pagos confirmados tienen su mes de energía.",
      (n) => `${n} ${plural(n, "pago confirmado no tiene", "pagos confirmados no tienen")} su mes de energía: el cliente pagó y su energía no está contando. Revisa la orden en Pagos.`,
      paidWithoutMonth.map((r) => ({ label: `${r.name}: orden ${r.id} (${formatCop(r.amountCop)})`, href: pagos(r.id) })),
    ),
    result(
      "mes-sin-pago",
      "error",
      "Cada mes de energía tiene su pago confirmado",
      monthWithoutPayment,
      "Ningún mes genera energía sin un pago confirmado.",
      (n) => `${n} ${plural(n, "mes genera", "meses generan")} energía sin un pago confirmado ni una devolución registrada. Revisa la orden en Pagos.`,
      monthWithoutPayment.map((r) => ({ label: `${r.name}: mes ${r.idx}, orden ${r.txId}`, href: pagos(r.txId) })),
    ),
    result(
      "meses-superpuestos",
      "error",
      "Los meses de un plan no se pisan",
      overlapping,
      "Ningún plan tiene dos meses al mismo tiempo.",
      (n) => `${n} ${plural(n, "caso de dos meses", "casos de dos meses")} del mismo plan al mismo tiempo: esa energía se estaría contando dos veces.`,
      overlapping.map((r) => ({ label: `${r.name}: ${r.subscriptionId}, meses ${r.first} y ${r.second}`, href: ficha(r.userId) })),
    ),
    result(
      "saldo-negativo",
      "error",
      "Ningún saldo queda en negativo",
      shortBy,
      "Lo retirado y lo apartado nunca supera la venta de la energía de cada cliente.",
      (n) => `${n} ${plural(n, "cliente tiene", "clientes tienen")} más retirado y apartado que la venta de su energía, sin una devolución por conciliar que lo explique.`,
      shortBy.map((r) => ({ label: `${names.get(r.userId) ?? r.userId}: faltan ${formatCop(r.deficit)}`, href: ficha(r.userId) })),
    ),
    result(
      "cupo",
      "error",
      "La energía vendida cabe en la planta",
      oversold,
      `Contratado ${formatNumber(Math.round(contracted))} de ${formatNumber(Math.round(plantDailyKwh))} kWh al día.`,
      () => `Hay ${formatNumber(Math.round(contracted))} kWh al día contratados y la planta produce ${formatNumber(Math.round(plantDailyKwh))}. Revisa la potencia en Planta.`,
      oversold.map(() => ({ label: "Planta", href: "/admin/planta" })),
    ),
    result(
      "retiros-esperando",
      "aviso",
      "Retiros esperando más de 3 días",
      staleWithdrawals,
      "Ningún retiro lleva más de 3 días esperando.",
      (n) => `${n} ${plural(n, "retiro lleva", "retiros llevan")} más de 3 días esperando el envío. El saldo de esos clientes sigue apartado.`,
      staleWithdrawals.map((r) => ({ label: `${r.name}: ${formatCop(r.amountCop)} (${r.id})`, href: "/admin/retiros" })),
    ),
    result(
      "transferencias-esperando",
      "aviso",
      "Transferencias sin confirmar hace más de 3 días",
      staleTransfers,
      "Ninguna transferencia reportada lleva más de 3 días sin confirmar.",
      (n) => `${n} ${plural(n, "transferencia reportada lleva", "transferencias reportadas llevan")} más de 3 días sin confirmar. Búscalas en el banco y confírmalas, o márcalas como «No llegó».`,
      staleTransfers.map((r) => ({ label: `${r.name}: ${formatCop(r.amountCop)} (${r.id})`, href: pagos(r.id) })),
    ),
    result(
      "devoluciones-esperando",
      "aviso",
      "Devoluciones sin conciliar hace más de 7 días",
      staleReviews,
      "Ninguna devolución de Mercado Pago lleva más de 7 días sin conciliar.",
      (n) => `${n} ${plural(n, "devolución de Mercado Pago lleva", "devoluciones de Mercado Pago llevan")} más de 7 días sin conciliar. Esas cuentas no pueden retirar mientras tanto.`,
      staleReviews.map((r) => ({ label: `${r.name}: orden ${r.paymentId}`, href: pagos(r.paymentId) })),
    ),
  ];
  return {
    checkedAt: now,
    checks,
    errors: checks.filter((c) => !c.ok && c.level === "error").length,
    warnings: checks.filter((c) => !c.ok && c.level === "aviso").length,
  };
}

/**
 * La pasada diaria del cuadre (con el cron): como mucho una vez cada 20 horas, y solo escribe a los propietarios
 * si algo no cuadra o lleva días esperando.
 */
export async function runDailyIntegrity({ now = Date.now() }: { now?: number } = {}) {
  if (!(await claimInterval({ id: "cuadre", intervalMs: 20 * HOUR_MS, clock: () => now }))) return { ran: false as const };
  const report = await checkIntegrity(now);
  if (report.errors || report.warnings) alertAdmin(() => alertMessages.integrity(report));
  return { ran: true as const, errors: report.errors, warnings: report.warnings };
}
