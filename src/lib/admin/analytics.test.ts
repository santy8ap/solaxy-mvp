import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser, fundUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-analytics-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let analytics: typeof import("@/lib/admin/analytics");
const MONTH_180 = 20_880_000;

beforeAll(async () => {
  analytics = await import("@/lib/admin/analytics");
  await createUser("a1", { name: "Renueva Pronto S.A.S." });
  await createUser("a2", { name: "En Pausa S.A.S." });
  await createUser("a3", { name: "Sin Pago S.A.S." });
  await createUser("a4", { profile: false, name: "Sin Datos" });
  // La cuenta de pruebas paga, pero no es un cliente.
  const { ensureDemoAccount } = await import("@/lib/db/seed");
  const { db } = await import("@/lib/db");
  await ensureDemoAccount(db);
  await fundUser("a1", { planId: "p180", days: 25 });
  await fundUser("a2", { planId: "p180", days: 40 });
}, 120_000);

describe("meses en hora de Colombia", () => {
  it("el mes de un instante, su inicio y los últimos 12", () => {
    // 1 de diciembre a las 3:00 UTC todavía es 30 de noviembre en Bogotá.
    expect(analytics.monthKey(Date.UTC(2026, 11, 1, 3))).toBe("2026-11");
    expect(analytics.monthKey(Date.UTC(2026, 11, 1, 5))).toBe("2026-12");
    expect(analytics.monthStartMs("2026-11")).toBe(Date.UTC(2026, 10, 1, 5));
    const months = analytics.lastMonths(Date.UTC(2026, 10, 12, 15), 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-12");
    expect(months[11]).toBe("2026-11");
    expect(analytics.lastMonths(Date.UTC(2026, 0, 10), 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(analytics.monthLabel("2026-11")).toBe("nov 2026");
  });
});

describe("analítica del negocio", () => {
  it("recaudo del mes, medios, embudo sin la cuenta de pruebas, renovaciones y lo que debería entrar", async () => {
    const a = await analytics.businessAnalytics();
    expect(a.months).toHaveLength(12);
    const current = a.months[11];
    // El plan de a2 empezó hace 40 días: cuenta en su mes, no en este (salvo que el mes acabe de empezar).
    const a2Month = analytics.monthKey(Date.now() - 40 * 86_400_000);
    expect(current).toMatchObject({ collectedCop: 2 * MONTH_180, payments: 2 });
    expect(a.months.reduce((s, m) => s + m.newPlans, 0)).toBe(2);
    expect(a.months.find((m) => m.month === a2Month)!.newPlans).toBeGreaterThanOrEqual(1);
    expect(current.newClients).toBe(4);
    expect(a.methods).toEqual([{ method: "demo", cop: 2 * MONTH_180, payments: 2 }]);
    expect(a.totals).toMatchObject({ collectedCop: 2 * MONTH_180, payments: 2, averageTicketCop: MONTH_180 });
    expect(a.funnel).toEqual({ registered: 4, withProfile: 3, paid: 2, active: 2 });
    expect(a.dueSoon.map((r) => r.customer)).toEqual(["Renueva Pronto S.A.S."]);
    expect(a.dueSoon[0]).toMatchObject({ planName: "Plan 180", nextMonth: 2, months: 3, amountCop: MONTH_180 });
    expect(a.paused.map((r) => r.customer)).toEqual(["En Pausa S.A.S."]);
    expect(a.paused[0].graceEndsAt).toBeGreaterThan(Date.now());
    expect(a.expectedNext30Cop).toBe(2 * MONTH_180);
    expect(a.capacity.contractedDailyKwh).toBeGreaterThan(0);
    expect(a.capacity.contractedDailyKwh).toBeLessThan(a.capacity.plantDailyKwh);
  });

  it("con dinero real, los pagos de prueba no cuentan como recaudo", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    try {
      const a = await analytics.businessAnalytics();
      expect(a.totals.collectedCop).toBe(0);
      expect(a.methods).toEqual([]);
      expect(a.funnel.paid).toBe(0);
    } finally {
      vi.stubEnv("DEMO_MODE", "");
    }
  });
});
