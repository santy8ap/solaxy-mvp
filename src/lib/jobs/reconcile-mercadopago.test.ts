import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-mpjobs-")), "test.db")}`;
vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-prueba");

let jobs: typeof import("./reconcile-mercadopago");
let tick: typeof import("./tick");
let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12, 15);

const order = (id: string, status: "pendiente" | "verificando" | "confirmada" | "fallida", ageDays: number, method: "mercadopago" | "crypto" = "mercadopago") => ({
  id,
  userId: "mp-owner",
  kind: "plan_mes" as const,
  status,
  method,
  amountCop: 20_880_000,
  createdAt: NOW - ageDays * DAY,
  confirmedAt: status === "confirmada" ? NOW - ageDays * DAY : null,
  providerId: status === "pendiente" ? null : `mp-${id}`,
});

beforeAll(async () => {
  jobs = await import("./reconcile-mercadopago");
  tick = await import("./tick");
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  await createUser("mp-owner");
  await database.db.insert(schema.ledgerTx).values([
    order("IWE-MP-PEND-1", "pendiente", 0.01),
    order("IWE-MP-PEND-2", "verificando", 1),
    order("IWE-MP-PEND-OLD", "pendiente", 5),
    order("IWE-MP-OK-RECENT", "confirmada", 20),
    order("IWE-MP-OK-OLD", "confirmada", 200),
    order("IWE-MP-FAILED", "fallida", 1),
    order("IWE-CRYPTO-PEND", "pendiente", 0.01, "crypto"),
  ]);
}, 120_000);

describe("conciliación de Mercado Pago (avisos perdidos)", () => {
  it("la pasada frecuente revisa los pagos pendientes de los últimos 3 días, aunque uno falle", async () => {
    const seen: string[] = [];
    const r = await jobs.reconcileMercadoPago({
      mode: "frecuente",
      clock: () => NOW,
      sync: async ({ orderId }) => {
        seen.push(orderId);
        if (orderId === "IWE-MP-PEND-1") throw new Error("Mercado Pago no respondió");
        return null;
      },
    });
    expect(seen.sort()).toEqual(["IWE-MP-PEND-1", "IWE-MP-PEND-2"]);
    expect(r).toMatchObject({ pending: 2, confirmed: 0, failed: 1 });
  });

  it("la pasada completa además busca devoluciones de los pagos confirmados de los últimos 180 días", async () => {
    const seen: string[] = [];
    const r = await jobs.reconcileMercadoPago({
      mode: "completo",
      clock: () => NOW,
      sync: async ({ orderId }) => {
        seen.push(orderId);
        return null;
      },
    });
    expect(seen.sort()).toEqual(["IWE-MP-OK-RECENT", "IWE-MP-PEND-1", "IWE-MP-PEND-2"]);
    expect(r).toMatchObject({ pending: 2, confirmed: 1, failed: 0 });
  });

  it("sin credenciales de Mercado Pago no consulta nada", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    const sync = vi.fn();
    expect(await jobs.reconcileMercadoPago({ mode: "completo", clock: () => NOW, sync })).toMatchObject({ skipped: "disabled" });
    expect(sync).not.toHaveBeenCalled();
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-prueba");
  });
});

describe("ejecución con las visitas (sin depender del cron diario)", () => {
  it("corre como máximo una vez cada 2 minutos en todo el sitio", async () => {
    const runs: number[] = [];
    const run = async () => {
      runs.push(1);
    };
    expect(await tick.maybeReconcile({ clock: () => NOW, run })).toBe(true);
    expect(await tick.maybeReconcile({ clock: () => NOW + 60_000, run })).toBe(false);
    expect(await tick.maybeReconcile({ clock: () => NOW + 121_000, run })).toBe(true);
    expect(runs).toHaveLength(2);
  });

  it("un error de la conciliación no se propaga a la visita", async () => {
    const run = async () => {
      throw new Error("falló");
    };
    await expect(tick.maybeReconcile({ clock: () => NOW + 10 * 60_000, run })).resolves.toBe(true);
  });
});
