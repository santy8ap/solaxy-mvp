import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-renewals-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

const DAY = 86_400_000;
let analytics: typeof import("@/lib/admin/analytics");

/** Paga los 3 meses de un plan y corre sus fechas `days` días hacia atrás. */
async function payAllMonths(userId: string, days: number) {
  const { payWithTestPayment } = await import("@/lib/payments/test-payment");
  const { db } = await import("@/lib/db");
  const { planPeriod } = await import("@/lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const first = await payWithTestPayment({ userId, planId: "p180" });
  const subscriptionId = first.order.subscriptionId as string;
  await payWithTestPayment({ userId, subscriptionId });
  await payWithTestPayment({ userId, subscriptionId });
  const shift = days * DAY;
  await db
    .update(planPeriod)
    .set({ startsAt: sql`${planPeriod.startsAt} - ${shift}`, endsAt: sql`${planPeriod.endsAt} - ${shift}` })
    .where(eq(planPeriod.subscriptionId, subscriptionId));
  return subscriptionId;
}

beforeAll(async () => {
  analytics = await import("@/lib/admin/analytics");
  await createUser("r1", { name: "Termina Pronto S.A.S." });
  await createUser("r2", { name: "Ya Terminó S.A.S." });
  await createUser("r3", { name: "Ya Renovó S.A.S." });
  await createUser("r4", { name: "Lejos S.A.S." });
  await payAllMonths("r1", 85); // el mes 3 termina en 5 días
  await payAllMonths("r2", 95); // terminó hace 5 días
  await payAllMonths("r3", 95); // terminó hace 5 días…
  const { payWithTestPayment } = await import("@/lib/payments/test-payment");
  await payWithTestPayment({ userId: "r3", planId: "p180" }); // …y compró otro igual
  await payAllMonths("r4", 30); // le quedan 60 días
}, 120_000);

describe("planes por renovar", () => {
  it("los que terminan en 14 días o terminaron hace poco, sin los que ya renovaron", async () => {
    const a = await analytics.businessAnalytics();
    expect(a.toRenew.map((r) => r.customer)).toEqual(["Ya Terminó S.A.S.", "Termina Pronto S.A.S."]);
    expect(a.toRenew[0].dueAt).toBeLessThan(Date.now());
    expect(a.toRenew[1].dueAt).toBeGreaterThan(Date.now());
  });
});
