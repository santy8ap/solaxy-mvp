import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bogotaMs } from "@/lib/time";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-cuadre-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

/**
 * Que el dinero cuadre: los mismos pagos y retiros, vistos desde el Resumen, Pagos, Clientes, Análisis y el panel
 * de cada comercializador, dan las mismas cifras. El escenario usa todos los medios de pago, un pago doble que se
 * reembolsa, una devolución de Mercado Pago, retiros pagados, en revisión y rechazados, y pagos en el borde del
 * día y del mes en hora de Colombia.
 */

let admin: typeof import("@/lib/admin/service");
let payments: typeof import("@/lib/admin/payments");
let analytics: typeof import("@/lib/admin/analytics");
let portfolio: typeof import("@/lib/portfolio");
let orders: typeof import("@/lib/orders");
let plans: typeof import("@/lib/plans/service");
let transfer: typeof import("@/lib/payments/transfer");
let reversals: typeof import("@/lib/payments/reversals");
let withdrawals: typeof import("@/lib/withdrawals");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

const actor = { id: "admin-cuadre", name: "Admin de prueba" };
const ACCOUNT = { bank: "Bancolombia", accountType: "corriente", accountNumber: "123-456789-01", holder: "X green Energy S.A.S.", holderId: "901234567-1" };
const BANK = { bank: "Bancolombia", accountType: "ahorros", accountNumber: "123-456789-01" };
const MONTH_180 = 20_880_000;
const MONTH_360 = 40_800_000;
/** Hoy: 10 de noviembre de 2026, 12:30 p. m. en Colombia. */
const NOW = bogotaMs(2026, 11, 10, 12, 30);
let doubleId = "";

/** Una orden de Mercado Pago como la que crea el checkout, sin pasar por la API del proveedor. */
async function mercadoPagoOrder(userId: string, planId: string) {
  const { orderCode } = await import("@/lib/ids");
  const p = await plans.resolvePlanPayment(userId, { planId }, Date.now());
  const id = orderCode();
  await dbMod.db.insert(schema.ledgerTx).values({
    id,
    userId,
    kind: "plan_mes",
    status: "pendiente",
    amountCop: p.amountCop,
    asset: "COP",
    createdAt: Date.now(),
    method: "mercadopago",
    expectedAmount: String(p.amountCop),
    subscriptionId: p.subscriptionId,
    periodIndex: p.periodIndex,
    kwh: p.kwh,
  });
  return id;
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  admin = await import("@/lib/admin/service");
  payments = await import("@/lib/admin/payments");
  analytics = await import("@/lib/admin/analytics");
  portfolio = await import("@/lib/portfolio");
  orders = await import("@/lib/orders");
  plans = await import("@/lib/plans/service");
  transfer = await import("@/lib/payments/transfer");
  reversals = await import("@/lib/payments/reversals");
  withdrawals = await import("@/lib/withdrawals");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { payWithTestPayment } = await import("@/lib/payments/test-payment");

  vi.setSystemTime(bogotaMs(2026, 9, 1, 9));
  for (const id of ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]) await createUser(id);
  await transfer.saveTransferAccount(actor, ACCOUNT);

  // 20 de septiembre: c1 paga el mes 1 del Plan 180 con el pago de prueba.
  vi.setSystemTime(bogotaMs(2026, 9, 20, 10));
  const { order: c1m1 } = await payWithTestPayment({ userId: "c1", planId: "p180" });

  // 15 de octubre: el admin registra a mano el mes 2 de c1.
  vi.setSystemTime(bogotaMs(2026, 10, 15, 9));
  await admin.registerManualPayment(actor, { userId: "c1", subscriptionId: c1m1.subscriptionId!, reference: "TRANSF-C1-M2" });

  // 31 de octubre a las 10 p. m. en Colombia (en UTC ya es 1 de noviembre): c2 reporta su transferencia y el admin la confirma.
  vi.setSystemTime(bogotaMs(2026, 10, 31, 22));
  const { order: c2 } = await transfer.reportTransfer({ userId: "c2", planId: "p360", receipt: "COMP-C2" });
  await transfer.confirmTransfer(actor, c2.id, "BCO-C2-0001");

  // 3 de noviembre: c4 paga con Mercado Pago; el 5, Mercado Pago devuelve el pago.
  vi.setSystemTime(bogotaMs(2026, 11, 3, 10));
  const c4 = await mercadoPagoOrder("c4", "p180");
  await orders.fulfillOrder(c4, { providerId: "mp-c4", providerStatus: "approved" });
  vi.setSystemTime(bogotaMs(2026, 11, 5, 10));
  await reversals.recordPaymentReversal(c4, "mp-c4", "refunded");

  // 8 de noviembre: c5 reporta una transferencia que el admin todavía no ha encontrado en el banco.
  vi.setSystemTime(bogotaMs(2026, 11, 8, 15));
  await transfer.reportTransfer({ userId: "c5", planId: "p180", receipt: "COMP-C5" });

  // 9 de noviembre a las 11 p. m. (en UTC ya es día 10): el admin registra a mano el pago de c6.
  vi.setSystemTime(bogotaMs(2026, 11, 9, 23));
  await admin.registerManualPayment(actor, { userId: "c6", planId: "p180", reference: "TRANSF-C6-M1" });

  // Hoy a las 6 a. m.: c3 abre dos pagos del mismo mes en Mercado Pago y los dos se aprueban.
  vi.setSystemTime(bogotaMs(2026, 11, 10, 6));
  const first = await mercadoPagoOrder("c3", "p180");
  doubleId = await mercadoPagoOrder("c3", "p180");
  await orders.fulfillOrder(first, { providerId: "mp-c3-a", providerStatus: "approved" });
  await orders.fulfillOrder(doubleId, { providerId: "mp-c3-b", providerStatus: "approved" });

  // Al mediodía, los retiros: uno pagado, uno esperando al admin y uno rechazado.
  vi.setSystemTime(bogotaMs(2026, 11, 10, 12));
  const paid = await withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 5_000_000, destination: BANK });
  await admin.decideWithdrawal(actor, paid.id, "aprobar", "", "ENVIO-000001");
  await withdrawals.createBankWithdrawal({ userId: "c1", amountCop: 3_000_000, destination: BANK });
  const rejected = await withdrawals.createBankWithdrawal({ userId: "c2", amountCop: 1_000_000, destination: BANK });
  await admin.decideWithdrawal(actor, rejected.id, "rechazar", "La cuenta no es de la empresa");

  vi.setSystemTime(NOW);
}, 120_000);

afterAll(() => {
  vi.useRealTimers();
});

/** Pagos confirmados, sumados directamente de la tabla de movimientos. */
async function confirmedPlanPayments() {
  const { and, eq, sql } = drizzle;
  const [row] = await dbMod.db
    .select({ cop: sql<number>`coalesce(sum(${schema.ledgerTx.amountCop}), 0)`, n: sql<number>`count(*)` })
    .from(schema.ledgerTx)
    .where(and(eq(schema.ledgerTx.kind, "plan_mes"), eq(schema.ledgerTx.status, "confirmada")));
  return { cop: Number(row.cop), n: Number(row.n) };
}

describe("lo que se les debe a los clientes", () => {
  it("los saldos de todos los clientes más los retiros por pagar suman exactamente «Se les debe»", async () => {
    const overview = await admin.adminOverview();
    const clients = await admin.listClients();
    const balances = clients.reduce((s, c) => s + c.balanceCop, 0);
    const reserved = clients.reduce((s, c) => s + c.reservedCop, 0);
    expect(reserved).toBe(3_000_000);
    expect(overview.pendingWithdrawalsCop).toBe(reserved);
    expect(overview.owedCop).toBe(balances + reserved);
  });

  it("a cualquier hora, con fracciones de peso de por medio, la venta se redondea hacia abajo cliente por cliente", async () => {
    vi.setSystemTime(NOW + 61_237);
    try {
      const clients = await admin.listClients();
      const raw = await Promise.all(clients.map((c) => portfolio.getBalance(c.id)));
      // El escenario sirve para esto solo si redondear el total y redondear cliente por cliente dan distinto.
      const roundedTotal = Math.floor(raw.reduce((s, b) => s + b.soldCop, 0));
      const roundedEach = raw.reduce((s, b) => s + Math.floor(b.soldCop), 0);
      expect(roundedTotal).toBeGreaterThan(roundedEach);
      const overview = await admin.adminOverview();
      expect(overview.soldCop).toBe(roundedEach);
      expect(overview.owedCop).toBe(clients.reduce((s, c) => s + c.balanceCop + c.reservedCop, 0));
    } finally {
      vi.setSystemTime(NOW);
    }
  });

  it("lo pagado en retiros es lo mismo en el Resumen, en Clientes y en Análisis; el rechazado no cuenta", async () => {
    const overview = await admin.adminOverview();
    const clients = await admin.listClients();
    expect(overview.paidOutCop).toBe(5_000_000);
    expect(clients.reduce((s, c) => s + c.withdrawnCop, 0)).toBe(5_000_000);
    expect((await analytics.businessAnalytics(NOW)).totals.withdrawnCop).toBe(5_000_000);
  });

  it("cada comercializador ve en su panel el mismo saldo que ve el admin", async () => {
    const clients = await admin.listClients();
    for (const c of clients) {
      const mine = await portfolio.getPortfolio(c.id);
      expect({ id: c.id, balance: mine.balanceCop, withdrawn: mine.withdrawnCop, reserved: mine.reservedCop }).toEqual({
        id: c.id,
        balance: c.balanceCop,
        withdrawn: c.withdrawnCop,
        reserved: c.reservedCop,
      });
      expect((await portfolio.getBalance(c.id)).balance).toBe(c.balanceCop);
    }
  });

  it("el saldo nunca se redondea hacia arriba: siempre es un número entero de pesos", async () => {
    for (const c of await admin.listClients()) {
      expect(Number.isInteger(c.balanceCop)).toBe(true);
      expect(c.balanceCop).toBeLessThanOrEqual(c.soldCop - c.withdrawnCop - c.reservedCop);
    }
  });

  it("con una devolución por conciliar, el saldo se sigue viendo pero no se puede retirar", async () => {
    const [c4] = (await admin.listClients()).filter((c) => c.id === "c4");
    expect(c4.balanceCop).toBeGreaterThan(0);
    await expect(withdrawals.createBankWithdrawal({ userId: "c4", amountCop: 50_000, destination: BANK })).rejects.toMatchObject({ status: 409 });
    expect((await admin.adminOverview()).reviewsPending).toBe(1);
  });
});

describe("el recaudo", () => {
  it("es el mismo en el Resumen, en Pagos y en Análisis, y solo cuenta pagos confirmados", async () => {
    // c1 mes 1 y mes 2, c2 (Plan 360), c6 y el primer pago de c3. No cuentan: la devolución de c4,
    // el pago doble de c3 ni la transferencia de c5 que nadie ha confirmado.
    const expected = 4 * MONTH_180 + MONTH_360;
    expect(await confirmedPlanPayments()).toEqual({ cop: expected, n: 5 });
    expect((await admin.adminOverview()).collectedCop).toBe(expected);
    expect((await payments.paymentSummary(NOW)).totalCop).toBe(expected);
    expect((await analytics.businessAnalytics(NOW)).totals).toMatchObject({ collectedCop: expected, payments: 5 });
  });

  it("cada medio de pago suma lo suyo y el total coincide", async () => {
    const { methods, totals } = await analytics.businessAnalytics(NOW);
    const by = Object.fromEntries(methods.map((m) => [m.method, { cop: m.cop, payments: m.payments }]));
    expect(by).toEqual({
      transferencia: { cop: MONTH_360, payments: 1 },
      manual: { cop: 2 * MONTH_180, payments: 2 },
      demo: { cop: MONTH_180, payments: 1 },
      mercadopago: { cop: MONTH_180, payments: 1 },
    });
    expect(methods.reduce((s, m) => s + m.cop, 0)).toBe(totals.collectedCop);
  });

  it("cada pago cuenta en el mes de Colombia en que se confirmó, también a las 10 p. m. del último día", async () => {
    const { months } = await analytics.businessAnalytics(NOW);
    const by = Object.fromEntries(months.map((m) => [m.month, { cop: m.collectedCop, payments: m.payments }]));
    expect(by["2026-09"]).toEqual({ cop: MONTH_180, payments: 1 });
    expect(by["2026-10"]).toEqual({ cop: MONTH_180 + MONTH_360, payments: 2 });
    expect(by["2026-11"]).toEqual({ cop: 2 * MONTH_180, payments: 2 });
    const overview = await admin.adminOverview();
    expect(overview.monthCollectedCop).toBe(by["2026-11"].cop);
    expect(overview.previousMonthCollectedCop).toBe(by["2026-10"].cop);
  });

  it("«Recaudado hoy» empieza a la medianoche de Colombia: el pago de las 11 p. m. de ayer no cuenta", async () => {
    expect((await payments.paymentSummary(NOW)).todayCop).toBe(MONTH_180);
  });

  it("el pago doble queda por reembolsar; al marcarlo reembolsado sale de lo pendiente y nunca cuenta como recaudo", async () => {
    const before = await payments.paymentSummary(NOW);
    expect(before.toRefund).toBe(1);
    expect((await admin.adminOverview()).paymentsToRefund).toBe(1);
    await payments.markRefunded(actor, doubleId, "DEV-MP-0001");
    const after = await payments.paymentSummary(NOW);
    expect(after).toMatchObject({ toRefund: 0, totalCop: before.totalCop, todayCop: before.todayCop });
    expect((await admin.adminOverview()).paymentsToRefund).toBe(0);
    // El reembolso no cambia la energía de c3: su mes sigue activo con el primer pago.
    const [sub] = await plans.listSubscriptions("c3");
    expect(sub.periods).toHaveLength(1);
  });

  it("la transferencia sin confirmar aparece por atender, no como recaudo", async () => {
    const overview = await admin.adminOverview();
    expect(overview.transfersToConfirm).toBe(1);
    expect((await payments.paymentSummary(NOW)).inProgress).toBe(1);
  });
});

describe("avisos repetidos", () => {
  it("dos avisos simultáneos de la misma transferencia dejan una sola orden", async () => {
    const report = () => transfer.reportTransfer({ userId: "c7", planId: "p180", receipt: "COMP-C7" });
    const results = await Promise.all([report(), report(), report()]);
    const { eq } = drizzle;
    const rows = await dbMod.db.select().from(schema.ledgerTx).where(eq(schema.ledgerTx.userId, "c7"));
    expect(rows).toHaveLength(1);
    expect(new Set(results.map((r) => r.order.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    // Y un solo plan en borrador para ese pago.
    const subs = await dbMod.db.select().from(schema.planSubscription).where(eq(schema.planSubscription.userId, "c7"));
    expect(subs).toHaveLength(1);
  });

  it("confirmar la misma transferencia dos veces a la vez activa el mes una sola vez", async () => {
    const { eq } = drizzle;
    const [row] = await dbMod.db.select().from(schema.ledgerTx).where(eq(schema.ledgerTx.userId, "c7"));
    const results = await Promise.allSettled([
      transfer.confirmTransfer(actor, row.id, "BCO-C7-0001"),
      transfer.confirmTransfer(actor, row.id, "BCO-C7-0001"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const periods = await dbMod.db.select().from(schema.planPeriod).where(eq(schema.planPeriod.txId, row.id));
    expect(periods).toHaveLength(1);
    const [after] = await dbMod.db.select().from(schema.ledgerTx).where(eq(schema.ledgerTx.id, row.id));
    expect(after).toMatchObject({ status: "confirmada", providerId: "BCO-C7-0001" });
    // La bitácora tiene la confirmación, una sola vez.
    const logs = await dbMod.db.select().from(schema.adminAudit).where(eq(schema.adminAudit.action, "confirmar_transferencia"));
    expect(logs.filter((l) => l.summary.includes(row.id))).toHaveLength(1);
  });

  it("dos solicitudes simultáneas para el mismo plan nuevo usan un solo borrador", async () => {
    await createUser("c8");
    const results = await Promise.all([1, 2, 3].map(() => plans.resolvePlanPayment("c8", { planId: "p360" }, NOW)));
    expect(new Set(results.map((r) => r.subscriptionId)).size).toBe(1);
  });
});
