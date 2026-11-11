import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-atomic-")), "test.db")}`;

let orders: typeof import("@/lib/orders");
let plans: typeof import("@/lib/plans/service");
let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let orm: typeof import("drizzle-orm");

beforeAll(async () => {
  orders = await import("@/lib/orders");
  plans = await import("@/lib/plans/service");
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  orm = await import("drizzle-orm");
  await createUser("atomic-owner");
}, 120000);

let sequence = 0;
async function pending() {
  // Un titular distinto mantiene separados los borradores de cada escenario.
  const userId = `atomic-${++sequence}`;
  await createUser(userId);
  const p = await plans.resolvePlanPayment(userId, { planId: "p180" });
  const id = `IWE-ATOMIC-${sequence}`;
  await database.db.insert(schema.ledgerTx).values({
    id,
    userId,
    kind: "plan_mes",
    status: "pendiente",
    method: "mercadopago",
    amountCop: p.amountCop,
    subscriptionId: p.subscriptionId,
    periodIndex: 1,
    kwh: p.kwh,
    createdAt: Date.now(),
  });
  return { id, subscriptionId: p.subscriptionId };
}

describe("confirmación y activación atómicas", () => {
  it("un fallo al insertar el periodo conserva la orden abierta y permite reintentar", async () => {
    const p = await pending();
    await database.db.run(
      orm.sql`CREATE TRIGGER fail_period BEFORE INSERT ON plan_period BEGIN SELECT RAISE(ABORT, 'injected period failure'); END`,
    );
    try {
      await expect(
        orders.fulfillOrder(p.id, { providerId: "atomic-proof-1" }),
      ).rejects.toThrow();
    } finally {
      await database.db.run(orm.sql`DROP TRIGGER fail_period`);
    }
    expect(await orders.getOrder(p.id)).toMatchObject({
      status: "pendiente",
      confirmedAt: null,
      providerId: null,
    });
    expect(
      (await plans.getSubscription(p.subscriptionId))?.periods,
    ).toHaveLength(0);
    expect(
      (await orders.fulfillOrder(p.id, { providerId: "atomic-proof-1" }))
        .outcome,
    ).toBe("confirmada");
    expect(
      (await plans.getSubscription(p.subscriptionId))?.periods,
    ).toHaveLength(1);
  });

  it("un fallo después de insertar el periodo revierte también ese periodo", async () => {
    const p = await pending();
    await database.db.run(
      orm.sql`CREATE TRIGGER fail_start BEFORE UPDATE OF started_at ON plan_subscription BEGIN SELECT RAISE(ABORT, 'injected start failure'); END`,
    );
    try {
      await expect(orders.fulfillOrder(p.id)).rejects.toThrow();
    } finally {
      await database.db.run(orm.sql`DROP TRIGGER fail_start`);
    }
    expect(await orders.getOrder(p.id)).toMatchObject({
      status: "pendiente",
      confirmedAt: null,
    });
    const sub = await plans.getSubscription(p.subscriptionId);
    expect(sub?.startedAt).toBeNull();
    expect(sub?.periods).toHaveLength(0);
    expect((await orders.fulfillOrder(p.id)).outcome).toBe("confirmada");
  });

  it("notificaciones concurrentes y reintentos solo activan un mes", async () => {
    const p = await pending();
    const attempts = await Promise.all([
      orders.fulfillOrder(p.id),
      orders.fulfillOrder(p.id),
    ]);
    expect(attempts.map((r) => r.outcome).sort()).toEqual([
      "confirmada",
      "ya_confirmada",
    ]);
    expect((await orders.fulfillOrder(p.id)).outcome).toBe("ya_confirmada");
    expect(
      (await plans.getSubscription(p.subscriptionId))?.periods,
    ).toHaveLength(1);
  });
});
