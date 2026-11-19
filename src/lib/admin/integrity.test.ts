import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DAY_MS, HOUR_MS, bogotaMs } from "@/lib/time";
import { createUser, fundUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-cuadre-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let integrity: typeof import("./integrity");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
let withdrawals: typeof import("@/lib/withdrawals");
const T0 = bogotaMs(2026, 11, 19, 12, 0);
const BANK = { bank: "Bancolombia", accountType: "ahorros", accountNumber: "123-456789-01" };

async function check(id: string, now = Date.now()) {
  const report = await integrity.checkIntegrity(now);
  return report.checks.find((c) => c.id === id)!;
}

/** Una fila de ledger_tx escrita a mano: los casos que el código nunca debería producir. */
async function tx(values: Partial<typeof import("@/lib/db/schema").ledgerTx.$inferInsert> & { id: string; userId: string }) {
  await dbMod.db.insert(schema.ledgerTx).values({ kind: "plan_mes", status: "confirmada", amountCop: 20_880_000, asset: "COP", createdAt: Date.now(), ...values });
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  integrity = await import("./integrity");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  withdrawals = await import("@/lib/withdrawals");
  for (const id of ["sano", "huerfano", "sin-pago", "doble", "negativo", "revision", "espera"]) {
    await createUser(id);
    await fundUser(id, { days: 10 });
  }
}, 120_000);

afterAll(() => {
  vi.useRealTimers();
});

describe("el cuadre de los números", () => {
  it("con datos sanos, todo cuadra: pagos con su mes, retiros dentro del saldo y la energía dentro de la planta", async () => {
    await withdrawals.createBankWithdrawal({ userId: "sano", amountCop: 1_000_000, destination: BANK });
    const report = await integrity.checkIntegrity();
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report).toMatchObject({ errors: 0, warnings: 0 });
    expect(report.checks.find((c) => c.id === "cupo")?.detail).toMatch(/Contratado 14\.000 de .* kWh al día/);
  });

  it("un pago confirmado sin su mes de energía es un error, con el enlace a la orden", async () => {
    await tx({ id: "XGE-HUERFANO", userId: "huerfano" });
    const c = await check("pago-sin-mes");
    expect(c).toMatchObject({ ok: false, level: "error", count: 1 });
    expect(c.items[0]).toEqual({ label: expect.stringContaining("XGE-HUERFANO"), href: "/admin/pagos?q=XGE-HUERFANO" });
  });

  it("un mes cuyo pago no está confirmado es un error, salvo que sea una devolución ya registrada", async () => {
    const [period] = await dbMod.db
      .select({ txId: schema.planPeriod.txId, subscriptionId: schema.planPeriod.subscriptionId })
      .from(schema.planPeriod)
      .innerJoin(schema.planSubscription, drizzle.eq(schema.planSubscription.id, schema.planPeriod.subscriptionId))
      .where(drizzle.eq(schema.planSubscription.userId, "sin-pago"));
    await dbMod.db.update(schema.ledgerTx).set({ status: "rechazada" }).where(drizzle.eq(schema.ledgerTx.id, period.txId));
    expect(await check("mes-sin-pago")).toMatchObject({ ok: false, count: 1, items: [{ label: expect.stringContaining(period.txId), href: `/admin/pagos?q=${period.txId}` }] });
    // Mercado Pago lo devolvió: la devolución registrada corta la energía de ese mes y queda por conciliar.
    await dbMod.db.update(schema.ledgerTx).set({ status: "reembolsada" }).where(drizzle.eq(schema.ledgerTx.id, period.txId));
    await dbMod.db.insert(schema.paymentReview).values({ paymentId: period.txId, userId: "sin-pago", subscriptionId: period.subscriptionId, occurredAt: Date.now(), reason: "refunded" });
    expect(await check("mes-sin-pago")).toMatchObject({ ok: true });
  });

  it("dos meses del mismo plan al mismo tiempo son un error (la energía se contaría dos veces)", async () => {
    const [p1] = await dbMod.db
      .select()
      .from(schema.planPeriod)
      .innerJoin(schema.planSubscription, drizzle.eq(schema.planSubscription.id, schema.planPeriod.subscriptionId))
      .where(drizzle.eq(schema.planSubscription.userId, "doble"));
    await tx({ id: "XGE-DOBLE-2", userId: "doble", subscriptionId: p1.plan_period.subscriptionId, periodIndex: 2 });
    await dbMod.db.insert(schema.planPeriod).values({
      ...p1.plan_period,
      id: "periodo-doble-2",
      idx: 2,
      txId: "XGE-DOBLE-2",
      startsAt: p1.plan_period.startsAt + 5 * DAY_MS,
      endsAt: p1.plan_period.endsAt + 5 * DAY_MS,
    });
    expect(await check("meses-superpuestos")).toMatchObject({ ok: false, count: 1, items: [{ label: expect.stringContaining("meses 1 y 2"), href: "/admin/clientes/doble" }] });
  });

  it("un saldo en negativo es un error, salvo en una cuenta con una devolución por conciliar", async () => {
    await tx({ id: "RET-DE-MAS", userId: "negativo", kind: "retiro", amountCop: 90_000_000 });
    const c = await check("saldo-negativo");
    expect(c).toMatchObject({ ok: false, count: 1 });
    expect(c.items[0]).toEqual({ label: expect.stringMatching(/^Empresa negativo: faltan \$\s?[\d.]+$/), href: "/admin/clientes/negativo" });
    // La misma situación con una devolución por conciliar ya está marcada en Pagos: el cuadre no la repite.
    await tx({ id: "RET-REVISION", userId: "revision", kind: "retiro", amountCop: 90_000_000 });
    const [sub] = await dbMod.db.select().from(schema.planSubscription).where(drizzle.eq(schema.planSubscription.userId, "revision"));
    const [pay] = await dbMod.db.select().from(schema.ledgerTx).where(drizzle.and(drizzle.eq(schema.ledgerTx.userId, "revision"), drizzle.eq(schema.ledgerTx.kind, "plan_mes")));
    await dbMod.db.insert(schema.paymentReview).values({ paymentId: pay.id, userId: "revision", subscriptionId: sub.id, occurredAt: Date.now(), reason: "charged_back" });
    expect((await check("saldo-negativo")).count).toBe(1);
  });

  it("más energía contratada que la que produce la planta es un error", async () => {
    const { PLANT } = await import("@/config/plant");
    const { invalidateSettings } = await import("@/lib/settings");
    const [before] = await dbMod.db.select().from(schema.plant).where(drizzle.eq(schema.plant.id, PLANT.id));
    await dbMod.db.update(schema.plant).set({ peakKw: 10 }).where(drizzle.eq(schema.plant.id, PLANT.id));
    invalidateSettings();
    expect(await check("cupo")).toMatchObject({ ok: false, items: [{ label: "Planta", href: "/admin/planta" }] });
    await dbMod.db.update(schema.plant).set({ peakKw: before.peakKw }).where(drizzle.eq(schema.plant.id, PLANT.id));
    invalidateSettings();
    expect(await check("cupo")).toMatchObject({ ok: true });
  });

  it("avisa de lo que lleva días esperando: retiros, transferencias y devoluciones sin conciliar", async () => {
    await withdrawals.createBankWithdrawal({ userId: "espera", amountCop: 500_000, destination: BANK });
    await tx({ id: "XGE-TRANSF", userId: "espera", method: "transferencia", status: "verificando" });
    const later = Date.now() + 8 * DAY_MS;
    const report = await integrity.checkIntegrity(later);
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId["retiros-esperando"]).toMatchObject({ ok: false, level: "aviso", items: expect.arrayContaining([{ label: expect.stringContaining("Empresa espera"), href: "/admin/retiros" }]) });
    expect(byId["transferencias-esperando"]).toMatchObject({ ok: false, level: "aviso", count: 1, items: [{ label: expect.stringContaining("XGE-TRANSF"), href: "/admin/pagos?q=XGE-TRANSF" }] });
    // La devolución de «sin-pago» se registró hoy: a los 8 días ya pasó el plazo para conciliarla.
    expect(byId["devoluciones-esperando"]).toMatchObject({ ok: false, level: "aviso" });
    expect(report.warnings).toBe(3);
    // Hoy, recién llegados, no son avisos todavía.
    const today = Object.fromEntries((await integrity.checkIntegrity()).checks.map((c) => [c.id, c.ok]));
    expect(today).toMatchObject({ "retiros-esperando": true, "transferencias-esperando": true, "devoluciones-esperando": true });
  });

  it("la pasada diaria corre como mucho una vez cada 20 horas y cuenta lo que encontró", async () => {
    // Siguen abiertos el pago sin mes, los meses que se pisan y el saldo en negativo (el mes sin pago quedó explicado).
    const first = await integrity.runDailyIntegrity({ now: Date.now() });
    expect(first).toEqual({ ran: true, errors: 3, warnings: 0 });
    expect(await integrity.runDailyIntegrity({ now: Date.now() + HOUR_MS })).toEqual({ ran: false });
    expect(await integrity.runDailyIntegrity({ now: Date.now() + 21 * HOUR_MS })).toMatchObject({ ran: true });
  });
});
