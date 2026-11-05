import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-seed-")), "test.db")}`;

let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");

beforeAll(async () => {
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
}, 120_000);

afterAll(() => vi.unstubAllEnvs());

describe("base de datos nueva con dinero real (DEMO_MODE=false)", () => {
  it("crea la planta y su telemetría, sin inversionistas ficticios ni cuenta demo", async () => {
    const { db } = dbMod;
    const plants = await db.select().from(schema.plant);
    expect(plants).toHaveLength(1);
    expect(await db.select().from(schema.user)).toHaveLength(0);
    expect(await db.select().from(schema.ledgerTx)).toHaveLength(0);
    expect(await db.select().from(schema.listing)).toHaveLength(0);
    expect((await db.select().from(schema.telemetry).limit(1)).length).toBe(1);
  });
});
