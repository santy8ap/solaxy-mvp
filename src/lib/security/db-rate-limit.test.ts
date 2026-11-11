import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Client } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { createDbRateLimiter } from "@/lib/security/db-rate-limit";

async function testClient() {
  const { client } = createDb(`file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-ratelimit-")), "rl.db")}`);
  await migrate(client, { localFile: true });
  return client;
}

describe("límite de intentos guardado en la base (compartido entre instancias de Vercel)", () => {
  it("deja pasar hasta el máximo dentro de la ventana y luego bloquea", async () => {
    const rl = createDbRateLimiter({ name: "ordenes", max: 3, windowMs: 60_000 }, await testClient());
    const t = 1_000_000;
    expect(await rl.hit("u", t)).toBe(true);
    expect(await rl.hit("u", t + 1)).toBe(true);
    expect(await rl.hit("u", t + 2)).toBe(true);
    expect(await rl.hit("u", t + 3)).toBe(false);
    expect(await rl.hit("otro", t + 3)).toBe(true);
    // Ventana nueva: el contador vuelve a empezar.
    expect(await rl.hit("u", t + 60_001)).toBe(true);
  });

  it("dos instancias con la misma base llevan la misma cuenta", async () => {
    const client = await testClient();
    const a = createDbRateLimiter({ name: "ordenes", max: 2, windowMs: 60_000 }, client);
    const b = createDbRateLimiter({ name: "ordenes", max: 2, windowMs: 60_000 }, client);
    const t = 2_000_000;
    expect(await a.hit("u", t)).toBe(true);
    expect(await b.hit("u", t + 1)).toBe(true);
    expect(await a.hit("u", t + 2)).toBe(false);
  });

  it("dos límites distintos no se suman aunque usen la misma clave", async () => {
    const client = await testClient();
    const orders = createDbRateLimiter({ name: "ordenes", max: 1, windowMs: 600_000 }, client);
    const sync = createDbRateLimiter({ name: "consultas", max: 1, windowMs: 600_000 }, client);
    const t = 3_000_000;
    expect(await orders.hit("u", t)).toBe(true);
    expect(await sync.hit("u", t)).toBe(true);
    expect(await orders.hit("u", t + 1)).toBe(false);
  });

  it("si la base falla, cuenta en memoria en lugar de bloquear los pagos", async () => {
    const broken = { execute: async () => Promise.reject(new Error("sin base")) } as unknown as Client;
    const rl = createDbRateLimiter({ name: "ordenes", max: 2, windowMs: 60_000 }, broken);
    const t = 4_000_000;
    expect(await rl.hit("u", t)).toBe(true);
    expect(await rl.hit("u", t + 1)).toBe(true);
    expect(await rl.hit("u", t + 2)).toBe(false);
  });
});
