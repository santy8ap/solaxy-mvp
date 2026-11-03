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
