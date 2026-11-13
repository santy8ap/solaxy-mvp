import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-aseo-")), "test.db")}`;

let jobs: typeof import("./housekeeping");
let tick: typeof import("./tick");
let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let orm: typeof import("drizzle-orm");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 12, 15);

type Row = typeof import("@/lib/db/schema").ledgerTx.$inferInsert;
const base = { userId: "aseo-1", kind: "plan_mes" as const, amountCop: 20_880_000 };
const ROWS: Row[] = [
  // Mercado Pago: sin pagar hace 3 días (abandonada), hace 1 día (todavía puede pagarse) y con un pago en proceso.
  { ...base, id: "XGE-MP-VIEJA", status: "pendiente", method: "mercadopago", createdAt: NOW - 3 * DAY },
  { ...base, id: "XGE-MP-RECIENTE", status: "pendiente", method: "mercadopago", createdAt: NOW - DAY },
  { ...base, id: "XGE-MP-EN-PROCESO", status: "pendiente", method: "mercadopago", providerId: "mp-777", createdAt: NOW - 10 * DAY },
  // Cripto: cotización vencida hace 2 días sin hash, una vigente y una que ya se está verificando.
  { ...base, id: "XGE-CR-VENCIDA", status: "pendiente", method: "crypto", createdAt: NOW - 2 * DAY - HOUR, expiresAt: NOW - 2 * DAY },
  { ...base, id: "XGE-CR-VIGENTE", status: "pendiente", method: "crypto", createdAt: NOW - 600_000, expiresAt: NOW + 600_000 },
  { ...base, id: "XGE-CR-VERIFICANDO", status: "verificando", method: "crypto", providerId: "0xabc", createdAt: NOW - 5 * DAY, expiresAt: NOW - 5 * DAY },
  // Una transferencia espera al admin el tiempo que haga falta.
  { ...base, id: "XGE-TR-VIEJA", status: "verificando", method: "transferencia", createdAt: NOW - 20 * DAY },
  // Retiros: a wallet sin firmar hace 2 días, sin firmar hace 5 minutos y uno esperando al admin.
  { ...base, id: "RET-SIN-FIRMA", kind: "retiro", status: "pendiente", amountCop: 500_000, createdAt: NOW - 2 * DAY },
  { ...base, id: "RET-FIRMANDO", kind: "retiro", status: "pendiente", amountCop: 500_000, createdAt: NOW - 300_000 },
  { ...base, id: "RET-POR-APROBAR", kind: "retiro", status: "por_aprobar", amountCop: 500_000, createdAt: NOW - 9 * DAY },
  // Otra cuenta: un pago sin pagar hace 2 horas.
  { ...base, id: "XGE-OTRA-2H", userId: "aseo-2", status: "pendiente", method: "mercadopago", createdAt: NOW - 2 * HOUR },
  { ...base, id: "XGE-OTRA-10MIN", userId: "aseo-2", status: "pendiente", method: "mercadopago", createdAt: NOW - 600_000 },
];

const statusOf = async (id: string) => {
  const [row] = await database.db.select().from(schema.ledgerTx).where(orm.eq(schema.ledgerTx.id, id));
  return { status: row.status, note: row.note };
};

beforeAll(async () => {
  jobs = await import("./housekeeping");
  tick = await import("./tick");
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  orm = await import("drizzle-orm");
  await createUser("aseo-1");
  await createUser("aseo-2");
  await database.db.insert(schema.ledgerTx).values(ROWS);
}, 120_000);

describe("órdenes abandonadas", () => {
  it("cierra como canceladas las que ya nadie va a pagar y deja quietas las demás", async () => {
    const r = await jobs.closeAbandonedOrders({ now: NOW });
    expect(r).toEqual({ mercadopago: 1, crypto: 1, otros: 0, retiros: 1 });

    expect(await statusOf("XGE-MP-VIEJA")).toEqual({ status: "cancelada", note: "No se completó el pago en Mercado Pago." });
    expect(await statusOf("XGE-CR-VENCIDA")).toEqual({ status: "cancelada", note: "La cotización venció sin que se registrara un pago." });
    expect(await statusOf("RET-SIN-FIRMA")).toEqual({ status: "cancelada", note: "El retiro no se firmó desde la wallet a tiempo." });

    for (const id of ["XGE-MP-RECIENTE", "XGE-MP-EN-PROCESO", "XGE-CR-VIGENTE", "XGE-OTRA-2H", "RET-FIRMANDO"]) expect((await statusOf(id)).status).toBe("pendiente");
    expect((await statusOf("XGE-CR-VERIFICANDO")).status).toBe("verificando");
    expect((await statusOf("XGE-TR-VIEJA")).status).toBe("verificando");
    expect((await statusOf("RET-POR-APROBAR")).status).toBe("por_aprobar");
  });

  it("volver a pasar no cambia nada", async () => {
    expect(await jobs.closeAbandonedOrders({ now: NOW })).toEqual({ mercadopago: 0, crypto: 0, otros: 0, retiros: 0 });
  });

  it("para una sola cuenta (antes de eliminarla) cierra lo que lleva más de una hora sin pagarse", async () => {
    const r = await jobs.closeAbandonedOrders({ now: NOW, userId: "aseo-2" });
    expect(r).toMatchObject({ mercadopago: 1 });
    expect((await statusOf("XGE-OTRA-2H")).status).toBe("cancelada");
    // Lo de hace 10 minutos puede estar pagándose ahora mismo.
    expect((await statusOf("XGE-OTRA-10MIN")).status).toBe("pendiente");
    // Lo de la otra cuenta no se toca.
    expect((await statusOf("XGE-MP-RECIENTE")).status).toBe("pendiente");
  });
});

describe("lo vencido que ya no sirve", () => {
  it("borra las sesiones y las verificaciones vencidas hace más de un día, y conserva las vigentes", async () => {
    const at = (ms: number) => new Date(ms);
    await database.db.insert(schema.session).values([
      { id: "s-vencida", token: "t-vencida", userId: "aseo-1", expiresAt: at(NOW - 2 * DAY), createdAt: at(NOW - 40 * DAY), updatedAt: at(NOW - 40 * DAY) },
      { id: "s-recien-vencida", token: "t-recien", userId: "aseo-1", expiresAt: at(NOW - HOUR), createdAt: at(NOW - 31 * DAY), updatedAt: at(NOW - 31 * DAY) },
      { id: "s-vigente", token: "t-vigente", userId: "aseo-1", expiresAt: at(NOW + 20 * DAY), createdAt: at(NOW - 10 * DAY), updatedAt: at(NOW - 10 * DAY) },
    ]);
    await database.db.insert(schema.verification).values([
      { id: "v-vencida", identifier: "estado-1", value: "x", expiresAt: at(NOW - 3 * DAY) },
      { id: "v-vigente", identifier: "estado-2", value: "x", expiresAt: at(NOW + 600_000) },
    ]);
    expect(await jobs.purgeExpired({ now: NOW })).toEqual({ sessions: 1, verifications: 1 });
    const sessions = await database.db.select({ id: schema.session.id }).from(schema.session);
    expect(sessions.map((s) => s.id).sort()).toEqual(["s-recien-vencida", "s-vigente"]);
    const verifications = await database.db.select({ id: schema.verification.id }).from(schema.verification);
    expect(verifications.map((v) => v.id)).toEqual(["v-vigente"]);
  });
});

describe("con las visitas", () => {
  it("el mantenimiento corre como máximo una vez por hora en todo el sitio", async () => {
    const runs: number[] = [];
    const run = async () => {
      runs.push(1);
      return {};
    };
    const t = NOW + 10 * DAY;
    expect(await jobs.maybeHousekeeping({ clock: () => t, run })).toBe(true);
    expect(await jobs.maybeHousekeeping({ clock: () => t + 30 * 60_000, run })).toBe(false);
    expect(await jobs.maybeHousekeeping({ clock: () => t + 61 * 60_000, run })).toBe(true);
    expect(runs).toHaveLength(2);
    // El turno es el mismo mecanismo del resto de tareas.
    expect(await tick.claimInterval({ id: "mantenimiento", intervalMs: HOUR, clock: () => t + 62 * 60_000 })).toBe(false);
  });

  it("un error del mantenimiento no se propaga a la visita", async () => {
    const run = async () => {
      throw new Error("falló");
    };
    await expect(jobs.maybeHousekeeping({ clock: () => NOW + 20 * DAY, run })).resolves.toBe(true);
  });
});
