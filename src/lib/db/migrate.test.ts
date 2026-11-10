import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { beforeAll, describe, expect, it } from "vitest";
import { alreadyApplied, migrate } from "@/lib/db/migrate";
import { MIGRATIONS } from "@/lib/db/migrations.generated";

let client: Client;
const count = async (table: string) => Number((await client.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
const tables = async () => (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map((r) => String(r.name));
const columns = async (table: string) => (await client.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name));

/** Una base como la que estaba en producción con el modelo anterior (compra de kW). */
beforeAll(async () => {
  client = createClient({ url: `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-migrate-")), "old.db")}` });
  await client.execute("CREATE TABLE __solaxy_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  for (const m of MIGRATIONS.slice(0, 3)) {
    for (const sql of m.statements) await client.execute(sql);
    await client.execute({ sql: "INSERT INTO __solaxy_migrations (id, applied_at) VALUES (?, 1)", args: [m.id] });
  }
  const user = (id: string, email: string) => client.execute({ sql: "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1)", args: [id, id, email] });
  await user("real-1", "socia@empresa.co");
  await user("real-2", "gerente@empresa.co");
  await user("inv-001", "inv-001@comunidad.solaxy.local");
  await user("inv-002", "inv-002@comunidad.solaxy.local");
  await client.execute("INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ('acc-1', 'g-1', 'google', 'real-1', 1, 1)");
  await client.execute("INSERT INTO plant (id, name, location, capacity_kwp, price_per_kw_cop, commissioned_at) VALUES ('solaxy-solar-1', 'Solaxy Solar I', 'Santa Fe de Antioquia, Antioquia', 2000, 4800000, 1)");
  await client.execute("INSERT INTO investor_profile (user_id, full_name, doc_type, doc_number, phone, city, terms_version, terms_accepted_at, created_at, updated_at) VALUES ('real-1', 'Laura Gómez', 'CC', '1036123456', '3001234567', 'Medellín', '2026-11-05', 5, 5, 5)");
  await client.execute("INSERT INTO investor_profile (user_id, full_name, doc_type, doc_number, phone, city, terms_version, terms_accepted_at, created_at, updated_at) VALUES ('real-2', 'Energía Andina S.A.S.', 'NIT', '900123456-8', '6044445555', 'Bogotá', '2026-11-05', 5, 5, 5)");
  await client.execute("INSERT INTO ledger_tx (id, user_id, kind, status, kw, amount_cop, created_at, method) VALUES ('SLX-OLD0000001', 'real-1', 'compra', 'confirmada', 2, 9600000, 10, 'mercadopago')");
  await client.execute("INSERT INTO ledger_tx (id, user_id, kind, status, kw, amount_cop, created_at) VALUES ('tx-old-2', 'inv-001', 'asignacion_demo', 'confirmada', 5, 24000000, 11)");
  await client.execute("INSERT INTO ledger_tx (id, user_id, kind, status, amount_cop, created_at) VALUES ('RET-OLD000001', 'real-1', 'retiro', 'confirmada', 50000, 12)");
  await client.execute("INSERT INTO position_entry (id, user_id, plant_id, kw_delta, price_per_kw_cop, ts) VALUES ('pe-1', 'real-1', 'solaxy-solar-1', 2, 4800000, 10)");
  await client.execute("INSERT INTO listing (id, seller_id, plant_id, kw, price_per_kw_cop, status, created_at) VALUES ('lst-1', 'inv-001', 'solaxy-solar-1', 1, 4700000, 'activa', 10)");
});

describe("migración del modelo de kW al de planes de energía", () => {
  it("archiva los movimientos anteriores y deja el libro limpio", async () => {
    await migrate(client, { localFile: true });
    expect(await count("legacy_ledger_tx")).toBe(3);
    expect(await count("ledger_tx")).toBe(0);
  });

  it("borra la comunidad ficticia y conserva las cuentas reales", async () => {
    const users = (await client.execute("SELECT id FROM user ORDER BY id")).rows.map((r) => r.id);
    expect(users).toEqual(["real-1", "real-2"]);
    expect(await count("account")).toBe(1);
  });

  it("pasa los datos del inversionista a datos de empresa (sin perder lo que ya había escrito)", async () => {
    const rows = (await client.execute("SELECT * FROM company_profile ORDER BY user_id")).rows;
    expect(rows[0]).toMatchObject({ user_id: "real-1", company_name: "", nit: "", full_name: "Laura Gómez", doc_type: "CC", doc_number: "1036123456", city: "Medellín" });
    expect(rows[1]).toMatchObject({ user_id: "real-2", company_name: "Energía Andina S.A.S.", nit: "900123456-8", full_name: "", doc_type: "CC", doc_number: "" });
  });

  it("elimina las tablas y columnas del modelo anterior y crea las de planes", async () => {
    const t = await tables();
    for (const gone of ["position_entry", "listing", "telemetry", "investor_profile"]) expect(t).not.toContain(gone);
    for (const made of ["plan_subscription", "plan_period", "company_profile", "legacy_ledger_tx"]) expect(t).toContain(made);
    const ledger = await columns("ledger_tx");
    expect(ledger).not.toContain("kw");
    expect(ledger).not.toContain("listing_id");
    expect(ledger).toEqual(expect.arrayContaining(["subscription_id", "period_index", "kwh", "bank_name", "bank_account_type", "bank_account_number"]));
    expect(await columns("plant")).toEqual(["id", "name", "location", "updated_at", "peak_kw", "sale_cop_per_kwh", "plan_prices"]);
    const plant = (await client.execute("SELECT * FROM plant")).rows[0];
    expect(plant).toMatchObject({ name: "Solaxy Solar I", peak_kw: 8000, sale_cop_per_kwh: 400, plan_prices: "{}" });
  });

  it("volver a migrar no hace nada", async () => {
    await migrate(client, { localFile: true });
    expect(await count("legacy_ledger_tx")).toBe(3);
  });

  it("si la limpieza se repite (quedó a medias), no borra los datos nuevos", async () => {
    await client.execute("INSERT INTO ledger_tx (id, user_id, kind, status, amount_cop, created_at, method, kwh) VALUES ('SLX-NEW0000001', 'real-1', 'plan_mes', 'confirmada', 20880000, 99, 'mercadopago', 60000)");
    await client.execute("DELETE FROM __solaxy_migrations WHERE id = '0004_limpieza'");
    await migrate(client, { localFile: true });
    expect(await count("ledger_tx")).toBe(1);
    expect(await count("legacy_ledger_tx")).toBe(3);
    expect(await count("company_profile")).toBe(2);
  });

  it("dos instancias que arrancan a la vez no chocan", async () => {
    await client.execute("DELETE FROM __solaxy_migrations WHERE id = '0004_limpieza'");
    await Promise.all([migrate(client, { localFile: true }), migrate(client, { localFile: true }), migrate(client, { localFile: true })]);
    expect((await client.execute("SELECT id FROM __solaxy_migrations ORDER BY id")).rows.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(await count("ledger_tx")).toBe(1);
  });

  it("solo tolera que falte algo cuando la sentencia quita o renombra", () => {
    expect(alreadyApplied("ALTER TABLE `x` ADD `y` text;", "duplicate column name: y")).toBe(true);
    expect(alreadyApplied("ALTER TABLE `ledger_tx` DROP COLUMN `kw`;", "no such column: kw")).toBe(true);
    expect(alreadyApplied("DROP TABLE `listing`;", "no such table: listing")).toBe(true);
    expect(alreadyApplied("DELETE FROM `ledger_tx` WHERE coalesce(`kw`, 0) = 0;", "no such column: kw")).toBe(true);
    expect(alreadyApplied("INSERT OR IGNORE INTO `a` SELECT * FROM `b`;", "no such table: b")).toBe(true);
    expect(alreadyApplied("INSERT INTO `a` SELECT * FROM `b`;", "no such table: b")).toBe(false);
    expect(alreadyApplied("CREATE INDEX `i` ON `t` (`nope`);", "no such column: nope")).toBe(false);
  });
});
