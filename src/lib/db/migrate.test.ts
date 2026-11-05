import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";

async function columns(client: ReturnType<typeof createDb>["client"], table: string) {
  const { rows } = await client.execute(`PRAGMA table_info(${table})`);
  return rows.map((r) => String(r.name));
}

describe("migraciones", () => {
  it("agregan la configuración editable de la planta, la nota de movimientos y la bitácora del admin", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solaxy-mig-"));
    const { client } = createDb(`file:${path.join(dir, "m.db")}`);
    await migrate(client);
    expect(await columns(client, "plant")).toEqual(
      expect.arrayContaining(["tariff_day_cop", "tariff_peak_cop", "commission_pct", "withdrawal_approval", "updated_at"]),
    );
    expect(await columns(client, "ledger_tx")).toContain("note");
    expect(await columns(client, "admin_audit")).toEqual(
      expect.arrayContaining(["id", "actor_user_id", "action", "target_user_id", "summary", "created_at"]),
    );
  });

  it("se pueden correr dos veces sin error", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solaxy-mig-"));
    const { client } = createDb(`file:${path.join(dir, "m.db")}`);
    await migrate(client);
    await expect(migrate(client)).resolves.toBeUndefined();
  });
});

describe("migración de pagos reales", () => {
  it("agrega el perfil del inversionista y los datos del proveedor de pago", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solaxy-mig-"));
    const { client } = createDb(`file:${path.join(dir, "m.db")}`);
    await migrate(client);
    expect(await columns(client, "investor_profile")).toEqual(
      expect.arrayContaining(["user_id", "full_name", "doc_type", "doc_number", "phone", "city", "terms_version", "terms_accepted_at"]),
    );
    expect(await columns(client, "ledger_tx")).toEqual(
      expect.arrayContaining(["method", "provider_id", "provider_status", "expected_amount", "expires_at"]),
    );
  });

  it("no deja registrar dos veces el mismo pago del mismo proveedor", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solaxy-mig-"));
    const { client } = createDb(`file:${path.join(dir, "m.db")}`);
    await migrate(client);
    await client.execute("INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u', 'U', 'u@x.co', 0, 0, 0)");
    const insert = (id: string, providerId: string | null) =>
      client.execute({
        sql: "INSERT INTO ledger_tx (id, user_id, kind, status, amount_cop, created_at, method, provider_id) VALUES (?, 'u', 'compra', 'pendiente', 1, 0, 'crypto', ?)",
        args: [id, providerId],
      });
    await insert("a", "0xabc");
    await expect(insert("b", "0xabc")).rejects.toThrow(/UNIQUE/i);
    await insert("c", null);
    await insert("d", null);
  });
});
