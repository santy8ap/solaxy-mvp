import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DAY_MS, bogotaMs } from "@/lib/time";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-admin-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let admin: typeof import("@/lib/admin/service");
let plans: typeof import("@/lib/plans/service");
let portfolio: typeof import("@/lib/portfolio");
let settings: typeof import("@/lib/settings");
let pay: typeof import("@/lib/payments/test-payment");
const actor = { id: "admin-test", name: "Admin de prueba" };
const T0 = bogotaMs(2026, 11, 10, 12, 30);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  admin = await import("@/lib/admin/service");
  plans = await import("@/lib/plans/service");
  portfolio = await import("@/lib/portfolio");
  settings = await import("@/lib/settings");
  pay = await import("@/lib/payments/test-payment");
  await createUser("a1", { name: "Textiles del Valle S.A.S." });
  await createUser("a2", { name: "Frigoríficos Andinos S.A." });
  await createUser("a3", { name: "Plásticos Unidos Ltda." });
  await createUser("nuevo", { profile: false, name: "Sin Empresa" });
}, 120_000);

afterAll(() => {
  vi.useRealTimers();
});

describe("pago manual (transferencia bancaria)", () => {
  it("exige la referencia del comprobante", async () => {
    await expect(admin.registerManualPayment(actor, { userId: "a1", planId: "p360", reference: " " })).rejects.toThrow(/referencia/i);
  });

  it("activa el mes, queda como pago real y deja constancia en la bitácora", async () => {
    const tx = await admin.registerManualPayment(actor, { userId: "a1", planId: "p360", reference: "TRANSF-0001" });
    expect(tx).toMatchObject({ kind: "plan_mes", status: "confirmada", method: "manual", amountCop: 40_800_000, kwh: 120_000, periodIndex: 1 });
    const [sub] = await plans.listSubscriptions("a1");
    expect(sub).toMatchObject({ planId: "p360", dailyKwh: 4000, priceCopPerKwh: 340 });
    const [entry] = await admin.listAudit(1);
    expect(entry).toMatchObject({ action: "pago_manual", targetUserId: "a1" });
    expect(entry.summary).toMatch(/Textiles del Valle.*Plan 360, mes 1 de 3.*TRANSF-0001/);
  });

  it("una referencia no se puede registrar dos veces", async () => {
    await expect(admin.registerManualPayment(actor, { userId: "a2", planId: "p180", reference: "TRANSF-0001" })).rejects.toMatchObject({ status: 409 });
    expect(await plans.listSubscriptions("a2")).toHaveLength(0);
  });

  it("el mes siguiente se registra sobre el plan del cliente", async () => {
    const [sub] = await plans.listSubscriptions("a1");
    const tx = await admin.registerManualPayment(actor, { userId: "a1", subscriptionId: sub.id, reference: "TRANSF-0002" });
    expect(tx).toMatchObject({ periodIndex: 2, subscriptionId: sub.id });
  });

  it("no se registra para un cliente que no ha completado los datos de su empresa", async () => {
    await expect(admin.registerManualPayment(actor, { userId: "nuevo", planId: "p180", reference: "TRANSF-0003" })).rejects.toMatchObject({ status: 412 });
  });
});

describe("cerrar un plan", () => {
  it("deja de generar energía en ese instante, libera el cupo y no admite más pagos", async () => {
    await pay.payWithTestPayment({ userId: "a2", planId: "p720" });
    const [sub] = await plans.listSubscriptions("a2");
    const before = await plans.contractedDailyKwh();
    vi.setSystemTime(T0 + 5 * DAY_MS);
    await expect(admin.closeSubscription(actor, sub.id, "")).rejects.toThrow(/motivo/);
    await admin.closeSubscription(actor, sub.id, "El pago fue devuelto por el banco");
    expect(await plans.contractedDailyKwh()).toBe(before - 8000);

    vi.setSystemTime(T0 + 20 * DAY_MS);
    const p = await portfolio.getPortfolio("a2");
    expect(p.subscriptions[0].state).toBe("cancelada");
    // Generó 5 días (40.000 kWh) y ahí se detuvo.
    expect(p.generatedKwh).toBeCloseTo(40_000, 4);
    expect(p.dailyKwh).toBe(0);
    await expect(pay.payWithTestPayment({ userId: "a2", subscriptionId: sub.id })).rejects.toMatchObject({ status: 409 });
    await expect(admin.closeSubscription(actor, sub.id, "otra vez")).rejects.toMatchObject({ status: 409 });
    vi.setSystemTime(T0);
  });
});

describe("clientes y resumen", () => {
  it("lista las empresas con sus planes, su energía y su saldo", async () => {
    // Seis días después del primer pago (el plan de a2 se cerró al quinto día).
    vi.setSystemTime(T0 + 6 * DAY_MS);
    const clients = await admin.listClients();
    const a1 = clients.find((c) => c.id === "a1")!;
    expect(a1.profile).toMatchObject({ companyName: "Textiles del Valle S.A.S.", nit: "900123456-8", termsCurrent: true });
    expect(a1.plans).toHaveLength(1);
    expect(a1.plans[0]).toMatchObject({ planName: "Plan 360", state: "activa", paidMonths: 2 });
    expect(a1.generatedKwh).toBeCloseTo(24_000, 4);
    expect(a1.balanceCop).toBe(9_600_000);
    expect(clients.find((c) => c.id === "nuevo")).toMatchObject({ profile: null, plans: [], balanceCop: 0 });
    // Primero quienes tienen planes.
    expect(clients[0].plans.length).toBeGreaterThan(0);
  });

  it("busca por razón social, NIT o correo", async () => {
    expect((await admin.listClients({ query: "frigor" })).map((c) => c.id)).toEqual(["a2"]);
    expect((await admin.listClients({ query: "a3@empresa" })).map((c) => c.id)).toEqual(["a3"]);
    expect(await admin.listClients({ query: "no-existe-xyz" })).toEqual([]);
  });

  it("el resumen muestra el cupo, lo cobrado y lo que se les debe a los clientes", async () => {
    const o = await admin.adminOverview();
    expect(o.plantDailyKwh).toBeCloseTo((8000 * 13 * 2) / Math.PI, 6);
    expect(o).toMatchObject({ contractedDailyKwh: 4000, activePlans: 1, clients: 1, pendingWithdrawals: 0 });
    expect(o.availableDailyKwh).toBeCloseTo(o.plantDailyKwh - 4000, 6);
    // Dos meses del Plan 360 (transferencias registradas) y uno del Plan 720 (pago de prueba).
    expect(o.collectedCop).toBe(40_800_000 * 2 + 76_800_000);
    // Con dinero real, lo cobrado no cuenta los pagos de prueba.
    vi.stubEnv("DEMO_MODE", "false");
    expect((await admin.adminOverview()).collectedCop).toBe(40_800_000 * 2);
    vi.stubEnv("DEMO_MODE", "");
    // a1: 24.000 kWh; a2: 40.000 kWh antes del cierre. Todo a $ 400.
    expect(o.owedCop).toBe(64_000 * 400);
    vi.setSystemTime(T0);
  });
});

describe("configuración de la planta y de los planes", () => {
  it("valida los precios: un plan debe costar menos que el precio de venta", async () => {
    const current = await settings.readSettings();
    await expect(admin.updatePlantSettings(actor, { ...current, planPrices: { ...current.planPrices, p180: 400 } })).rejects.toThrow(/menor que el precio de venta/);
    await expect(admin.updatePlantSettings(actor, { ...current, saleCopPerKwh: 340 })).rejects.toThrow(/menor que el precio de venta/);
    await expect(admin.updatePlantSettings(actor, { ...current, name: "" })).rejects.toThrow(/nombre/);
  });

  it("no deja bajar la potencia por debajo de lo ya contratado", async () => {
    const current = await settings.readSettings();
    await expect(admin.updatePlantSettings(actor, { ...current, peakKw: 400 })).rejects.toThrow(/ya contratados/);
  });

  it("un precio nuevo aplica a los planes nuevos; los ya comprados conservan sus condiciones", async () => {
    const current = await settings.readSettings();
    const next = await admin.updatePlantSettings(actor, { ...current, saleCopPerKwh: 420, planPrices: { ...current.planPrices, p180: 350 } });
    expect(next).toMatchObject({ saleCopPerKwh: 420, planPrices: { p720: 320, p540: 330, p360: 340, p180: 350 } });
    const catalog = await plans.getCatalog();
    expect(catalog.plans.find((p) => p.id === "p180")).toMatchObject({ priceCopPerKwh: 350, saleCopPerKwh: 420, monthlyCop: 21_000_000, profitPerKwhCop: 70 });

    await pay.payWithTestPayment({ userId: "a3", planId: "p180" });
    expect((await plans.listSubscriptions("a3"))[0]).toMatchObject({ priceCopPerKwh: 350, saleCopPerKwh: 420 });
    expect((await plans.listSubscriptions("a1"))[0]).toMatchObject({ priceCopPerKwh: 340, saleCopPerKwh: 400 });
    const entry = (await admin.listAudit(20)).find((e) => e.action === "config_planta");
    expect(entry?.summary).toMatch(/precio de venta.*precios de los planes/);
  });
});
