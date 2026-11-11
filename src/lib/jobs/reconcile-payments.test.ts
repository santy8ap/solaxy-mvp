import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-jobs-")), "test.db")}`;
vi.stubEnv(
  "CRYPTO_TREASURY_ADDRESS",
  "0x2222222222222222222222222222222222222222",
);
let jobs: typeof import("./reconcile-payments");
let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let orm: typeof import("drizzle-orm");

beforeAll(async () => {
  jobs = await import("./reconcile-payments");
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  orm = await import("drizzle-orm");
  await createUser("job-owner");
  await database.db
    .insert(schema.ledgerTx)
    .values([
      ...["IWE-JOB-A", "IWE-JOB-B", "IWE-JOB-C"].map((id) => ({
        id,
        userId: "job-owner",
        kind: "plan_mes" as const,
        status: "verificando" as const,
        method: "crypto" as const,
        amountCop: 20880000,
        providerId: `hash-${id}`,
        createdAt: Date.now(),
      })),
      {
        id: "IWE-JOB-PENDING",
        userId: "job-owner",
        kind: "plan_mes",
        status: "pendiente",
        method: "crypto",
        amountCop: 20880000,
        createdAt: Date.now(),
      },
      {
        id: "IWE-JOB-MP",
        userId: "job-owner",
        kind: "plan_mes",
        status: "verificando",
        method: "mercadopago",
        amountCop: 20880000,
        providerId: "mp-job",
        createdAt: Date.now(),
      },
    ]);
}, 120000);

const successful = async () => ({
  state: "esperando" as const,
  order: {} as never,
  confirmations: 1,
  needed: 5,
});

describe("reconciliación durable", () => {
  it("procesa sin sesión y continúa después de un fallo del nodo", async () => {
    const ids: string[] = [];
    const result = await jobs.reconcilePayments({
      verify: async (id) => {
        ids.push(id);
        if (id === "IWE-JOB-A")
          throw new Error("nodo temporalmente fuera de servicio");
        return successful();
      },
    });
    expect(ids).toEqual(["IWE-JOB-A", "IWE-JOB-B", "IWE-JOB-C"]);
    expect(result).toMatchObject({ processed: 3, failed: 1 });
    const [state] = await database.db.select().from(schema.jobState);
    expect(state).toMatchObject({ lockedUntil: 0, cursor: "IWE-JOB-C" });
  });

  it("una ejecución en curso excluye otra y una caída libera el turno al vencer el arrendamiento", async () => {
    const now = Date.now();
    await database.db.update(schema.jobState).set({ lockedUntil: now + 1000 });
    const verify = vi.fn(successful);
    expect(
      await jobs.reconcilePayments({ verify, clock: () => now }),
    ).toMatchObject({ skipped: "locked" });
    expect(verify).not.toHaveBeenCalled();
    expect(
      await jobs.reconcilePayments({ verify, clock: () => now + 1001 }),
    ).toMatchObject({ processed: 3 });
  });

  it("guarda el cursor al agotar el presupuesto y reanuda sin bloquear siempre la primera orden", async () => {
    await database.db
      .update(schema.jobState)
      .set({ cursor: null, lockedUntil: 0 });
    let now = Date.now() + 2000;
    const ids: string[] = [];
    expect(
      await jobs.reconcilePayments({
        clock: () => now,
        verify: async (id) => {
          ids.push(id);
          now += 31000;
          return successful();
        },
      }),
    ).toMatchObject({ processed: 1 });
    expect(ids).toEqual(["IWE-JOB-A"]);
    const next: string[] = [];
    await jobs.reconcilePayments({
      clock: () => now,
      verify: async (id) => {
        next.push(id);
        return successful();
      },
    });
    expect(next).toEqual(["IWE-JOB-B", "IWE-JOB-C"]);
    expect(
      (
        await database.db
          .select()
          .from(schema.jobState)
          .where(orm.eq(schema.jobState.id, "reconcile-crypto"))
      )[0].lockedUntil,
    ).toBe(0);
  });
});

describe("acceso del programador", () => {
  it("rechaza claves ausentes, cortas, erróneas y enviadas sin Bearer", async () => {
    const { authorizedCron } = await import("./auth");
    vi.stubEnv("CRON_SECRET", "");
    expect(authorizedCron(null)).toBe(false);
    expect(authorizedCron("Bearer undefined")).toBe(false);
    vi.stubEnv("CRON_SECRET", "clave-de-trabajo-exclusiva-de-pruebas-123456");
    expect(authorizedCron("Bearer otra-clave")).toBe(false);
    expect(authorizedCron("clave-de-trabajo-exclusiva-de-pruebas-123456")).toBe(
      false,
    );
    expect(
      authorizedCron("Bearer clave-de-trabajo-exclusiva-de-pruebas-123456"),
    ).toBe(true);
    vi.unstubAllEnvs();
  });
});
