import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser, fundUser } from "../../../tests/helpers";

const dir = mkdtempSync(path.join(tmpdir(), "xge-respaldo-"));
process.env.DATABASE_URL = `file:${path.join(dir, "origen.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let format: typeof import("./backup-format");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let migrate: typeof import("./migrate");

async function backupText() {
  const chunks: string[] = [];
  for await (const c of format.backupChunks(dbMod.client, { migrations: await format.appliedMigrations(dbMod.client), now: Date.UTC(2026, 10, 13, 15) })) chunks.push(c);
  return chunks.join("");
}

/** Una base nueva, con el esquema completo y la fila de la planta que crea la app al arrancar. */
async function freshDatabase(name: string) {
  const client = createClient({ url: `file:${path.join(dir, name)}` });
  await migrate.migrate(client, { localFile: true });
  await client.execute("INSERT INTO plant (id, name, location) VALUES ('solaxy-solar-1', 'Planta nueva', 'Sin ubicación')");
  return client;
}

beforeAll(async () => {
  format = await import("./backup-format");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  migrate = await import("./migrate");
  await createUser("r1", { name: "Respaldo Uno S.A.S." });
  await createUser("r2", { name: "Respaldo Dos S.A.S." });
  await fundUser("r1", { planId: "p180", days: 10 });
  await fundUser("r2", { planId: "p360", days: 3 });
  const now = Date.now();
  // Lo que no debe salir en el respaldo: una sesión y el acceso de Google con su token.
  await dbMod.db.insert(schema.session).values({ id: "ses-r1", token: "token-de-sesion-secreto", userId: "r1", expiresAt: new Date(now + 86_400_000), createdAt: new Date(now), updatedAt: new Date(now) });
  await dbMod.db.insert(schema.account).values({ id: "acc-r1", accountId: "google-r1", providerId: "google", userId: "r1", accessToken: "token-de-google-secreto", createdAt: new Date(now), updatedAt: new Date(now) });
  await dbMod.db.insert(schema.adminAudit).values({ id: "aud-r1", actorUserId: "admin", actorName: "Admin", action: "pago_manual", summary: "Con «comillas» y \"dobles\"\ny saltos", createdAt: now });
}, 120_000);

describe("respaldo de los datos", () => {
  it("es un JSON con todas las tablas del negocio y sin sesiones, tokens ni límites de uso", async () => {
    const text = await backupText();
    const backup = format.parseBackup(JSON.parse(text));
    expect(backup).toMatchObject({ formato: "x-green-energy/respaldo", version: 1, generadoEn: "2026-11-13T15:00:00.000Z" });
    expect(Object.keys(backup.tablas)).toEqual([...format.BACKUP_TABLES]);
    expect(backup.tablas.user.map((u) => u.id).sort()).toEqual(["r1", "r2"]);
    expect(backup.tablas.plan_subscription).toHaveLength(2);
    expect(backup.tablas.plan_period).toHaveLength(2);
    expect(backup.tablas.ledger_tx).toHaveLength(2);
    expect(backup.migraciones.length).toBeGreaterThan(5);
    for (const secret of ["token-de-sesion-secreto", "token-de-google-secreto", "access_token"]) expect(text).not.toContain(secret);
    for (const table of ["session", "account", "verification", "rate_limit", "job_state"]) expect(Object.keys(backup.tablas)).not.toContain(table);
  });

  it("se restaura completo en una base nueva y los saldos quedan iguales", async () => {
    const backup = format.parseBackup(JSON.parse(await backupText()));
    const target = await freshDatabase("destino.db");
    const counts = await format.restoreBackup(target, backup);
    expect(counts).toMatchObject({ user: 2, company_profile: 2, plan_subscription: 2, plan_period: 2, ledger_tx: 2, admin_audit: 1, plant: 1 });
    for (const table of format.BACKUP_TABLES) {
      const a = await dbMod.client.execute(`SELECT * FROM "${table}" ORDER BY rowid`);
      const b = await target.execute(`SELECT * FROM "${table}" ORDER BY rowid`);
      const values = (rs: typeof a) => rs.rows.map((r) => rs.columns.map((_, i) => r[i]));
      expect({ table, rows: values(b) }).toEqual({ table, rows: values(a) });
    }
    // Las sesiones y los accesos no viajan: cada persona vuelve a entrar con Google.
    expect((await target.execute("SELECT count(*) AS n FROM session")).rows[0].n).toBe(0);
    expect((await target.execute("SELECT count(*) AS n FROM account")).rows[0].n).toBe(0);
    target.close();
  });

  it("no restaura sobre una base que ya tiene datos, ni un archivo que no es un respaldo", async () => {
    const backup = format.parseBackup(JSON.parse(await backupText()));
    const target = await freshDatabase("con-datos.db");
    await format.restoreBackup(target, backup);
    await expect(format.restoreBackup(target, backup)).rejects.toThrow(/ya tiene datos/);
    expect(() => format.parseBackup({ hola: 1 })).toThrow(/no es un respaldo/);
    expect(() => format.parseBackup({ ...backup, version: 9 })).toThrow(/versión 9/);
    target.close();
  });

  it("si a la base de destino le faltan migraciones, lo dice y no escribe nada", async () => {
    const backup = format.parseBackup(JSON.parse(await backupText()));
    const target = await freshDatabase("vieja.db");
    await expect(format.restoreBackup(target, { ...backup, migraciones: [...backup.migraciones, "9999_del_futuro"] })).rejects.toThrow(/9999_del_futuro/);
    expect((await target.execute("SELECT count(*) AS n FROM user")).rows[0].n).toBe(0);
    target.close();
  });
});
