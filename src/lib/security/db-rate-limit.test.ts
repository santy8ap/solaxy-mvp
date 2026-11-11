import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { createDbRateLimiter } from "@/lib/security/db-rate-limit";

async function createTestLimiter({ max = 3, windowMs = 60_000 } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "solaxy-ratelimit-"));
  const { client } = createDb(`file:${path.join(dir, "rl.db")}`);
  await migrate(client, { localFile: true });
  return createDbRateLimiter({ max, windowMs }, client);
}

describe("rate limiter persistente en BD", () => {
  it("permite hasta el máximo dentro de la ventana y luego bloquea", async () => {
    const rl = await createTestLimiter({ max: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect(await rl.hit("u", t)).toBe(true);
    expect(await rl.hit("u", t + 1)).toBe(true);
    expect(await rl.hit("u", t + 2)).toBe(true);
    expect(await rl.hit("u", t + 3)).toBe(false);
    expect(await rl.hit("otro", t + 3)).toBe(true);
    // Nueva ventana: se reinicia el contador
    expect(await rl.hit("u", t + 60_001)).toBe(true);
  });

  it("comparte el contador entre instancias del limitador (misma BD)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solaxy-ratelimit-"));
    const { client } = createDb(`file:${path.join(dir, "rl2.db")}`);
    await migrate(client, { localFile: true });
    const rl1 = createDbRateLimiter({ max: 2, windowMs: 60_000 }, client);
    const rl2 = createDbRateLimiter({ max: 2, windowMs: 60_000 }, client);
    const t = 2_000_000;
    expect(await rl1.hit("u", t)).toBe(true);
    expect(await rl2.hit("u", t + 1)).toBe(true);
    expect(await rl1.hit("u", t + 2)).toBe(false); // ya alcanzó el max de 2
  });
});