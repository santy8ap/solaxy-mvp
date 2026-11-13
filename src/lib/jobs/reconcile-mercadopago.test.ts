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

const order = (
  id: string,
  status: "pendiente" | "verificando" | "confirmada" | "fallida",
  ageDays: number,
  method: "mercadopago" | "crypto" = "mercadopago",
  /** Si Mercado Pago ya tiene un pago de esta orden (aprobado o en proceso) */
  withPayment = status !== "pendiente",
) => ({
  id,
  userId: "mp-owner",
  kind: "plan_mes" as const,
  status,
  method,
  amountCop: 20_880_000,
  createdAt: NOW - ageDays * DAY,
  confirmedAt: status === "confirmada" ? NOW - ageDays * DAY : null,
  providerId: withPayment ? `mp-${id}` : null,
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
    // PSE en proceso desde hace 10 días: Mercado Pago ya tiene el pago, así que se sigue consultando.
    order("IWE-MP-PROC-10D", "pendiente", 10, "mercadopago", true),
    order("IWE-MP-PROC-40D", "pendiente", 40, "mercadopago", true),
    order("IWE-MP-OK-RECENT", "confirmada", 20),
    order("IWE-MP-OK-OLD", "confirmada", 200),
    order("IWE-MP-FAILED", "fallida", 1),
    order("IWE-CRYPTO-PEND", "pendiente", 0.01, "crypto"),
  ]);
}, 120_000);

describe("conciliación de Mercado Pago (avisos perdidos)", () => {
  it("la pasada frecuente revisa los pagos sin pagar de los últimos 2 días y los que están en proceso hasta 30, aunque uno falle", async () => {
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
    expect(seen.sort()).toEqual(["IWE-MP-PEND-1", "IWE-MP-PEND-2", "IWE-MP-PROC-10D"]);
    expect(r).toMatchObject({ pending: 3, confirmed: 0, failed: 1 });
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
    expect(seen.sort()).toEqual(["IWE-MP-OK-RECENT", "IWE-MP-PEND-1", "IWE-MP-PEND-2", "IWE-MP-PROC-10D"]);
    expect(r).toMatchObject({ pending: 3, confirmed: 1, failed: 0 });
  });

  it("con más órdenes abiertas de las que caben en una pasada, las revisa todas por turnos (no siempre las mismas)", async () => {
    const extra = Array.from({ length: 14 }, (_, i) => order(`IWE-MP-ROT-${String(i + 1).padStart(2, "0")}`, "pendiente", 0.5));
    await database.db.insert(schema.ledgerTx).values(extra);
    const pass = async () => {
      const seen: string[] = [];
      await jobs.reconcileMercadoPago({ mode: "frecuente", clock: () => NOW, sync: async ({ orderId }) => void seen.push(orderId) });
      return seen;
    };
    const first = await pass();
    const second = await pass();
    // Cada pasada revisa 10 distintas, y entre las dos cubren las 17 abiertas.
    expect(new Set(first).size).toBe(10);
    expect(new Set(second).size).toBe(10);
    expect(new Set([...first, ...second]).size).toBe(17);
  });

  it("con más de 50 pagos confirmados, las devoluciones se buscan en todos por turnos", async () => {
    const extra = Array.from({ length: 60 }, (_, i) => order(`IWE-MP-CONF-${String(i + 1).padStart(2, "0")}`, "confirmada", 3));
    await database.db.insert(schema.ledgerTx).values(extra);
    const pass = async () => {
      const seen: string[] = [];
      await jobs.reconcileMercadoPago({ mode: "completo", clock: () => NOW, sync: async ({ orderId }) => void seen.push(orderId) });
      return seen.filter((id) => id.startsWith("IWE-MP-CONF-") || id === "IWE-MP-OK-RECENT");
    };
    const first = await pass();
    const second = await pass();
    expect(first).toHaveLength(50);
    expect(new Set([...first, ...second]).size).toBe(61);
  });

  it("si se acaba el tiempo a mitad de la pasada, la siguiente sigue donde quedó", async () => {
    let t = NOW;
    const seen: string[] = [];
    // Cada consulta "tarda" 9 segundos: el presupuesto de 20 alcanza para 3.
    const slow = async ({ orderId }: { orderId: string }) => {
      seen.push(orderId);
      t += 9_000;
    };
    await jobs.reconcileMercadoPago({ mode: "frecuente", clock: () => t, sync: slow });
    expect(seen).toHaveLength(3);
    const firstThree = [...seen];
    t = NOW;
    await jobs.reconcileMercadoPago({ mode: "frecuente", clock: () => t, sync: slow });
    expect(seen).toHaveLength(6);
    expect(seen.slice(3).some((id) => firstThree.includes(id))).toBe(false);
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

describe("la ruta del cron no se puede lanzar seguido, aunque alguien tenga la clave", () => {
  it("se reclama como máximo una vez por intervalo", async () => {
    const t = NOW + 3_600_000;
    expect(await tick.claimInterval({ id: "cron-prueba", intervalMs: 10 * 60_000, clock: () => t })).toBe(true);
    expect(await tick.claimInterval({ id: "cron-prueba", intervalMs: 10 * 60_000, clock: () => t + 5 * 60_000 })).toBe(false);
    expect(await tick.claimInterval({ id: "cron-prueba", intervalMs: 10 * 60_000, clock: () => t + 11 * 60_000 })).toBe(true);
  });
});
