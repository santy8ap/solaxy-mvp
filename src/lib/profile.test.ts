import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "solaxy-profile-")), "test.db")}`;

let profile: typeof import("@/lib/profile");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

beforeAll(async () => {
  profile = await import("@/lib/profile");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { ensureReady } = await import("@/lib/db/init");
  await ensureReady();
}, 120_000);

const input = { fullName: "Laura Gómez", docType: "CC", docNumber: "1.036.123.456", phone: "300 123 4567", city: "Medellín", acceptTerms: true };

describe("perfil del inversionista", () => {
  it("guarda los datos normalizados con la versión de los términos y la fecha", async () => {
    const before = Date.now();
    const p = await profile.saveProfile("inv-010", input);
    expect(p).toMatchObject({ fullName: "Laura Gómez", docNumber: "1036123456", phone: "3001234567", termsVersion: profile.TERMS_VERSION, complete: true });
    expect(p.termsAcceptedAt).toBeGreaterThanOrEqual(before);
    expect(await profile.getProfile("inv-010")).toEqual(p);
  });

  it("al actualizar conserva la fecha de creación", async () => {
    const first = await profile.saveProfile("inv-011", input);
    const second = await profile.saveProfile("inv-011", { ...input, city: "Envigado" });
    expect(second.city).toBe("Envigado");
    const [row] = await dbMod.db.select().from(schema.investorProfile).where(drizzle.eq(schema.investorProfile.userId, "inv-011"));
    expect(row.createdAt).toBeLessThanOrEqual(first.termsAcceptedAt ?? 0);
  });

  it("rechaza datos inválidos indicando el campo", async () => {
    await expect(profile.saveProfile("inv-012", { ...input, phone: "123" })).rejects.toMatchObject({ status: 400, extra: { fields: { phone: expect.any(String) } } });
  });

  it("exige el perfil completo antes de pagar", async () => {
    await expect(profile.requireCompleteProfile("inv-013")).rejects.toMatchObject({ status: 412, extra: { code: "perfil_incompleto" } });
    await profile.saveProfile("inv-013", input);
    await expect(profile.requireCompleteProfile("inv-013")).resolves.toMatchObject({ complete: true });
  });

  it("si cambian los términos, hay que aceptarlos de nuevo", async () => {
    await profile.saveProfile("inv-014", input);
    await dbMod.db.update(schema.investorProfile).set({ termsVersion: "2020-01-01" }).where(drizzle.eq(schema.investorProfile.userId, "inv-014"));
    expect((await profile.getProfile("inv-014"))?.complete).toBe(false);
    await expect(profile.requireCompleteProfile("inv-014")).rejects.toMatchObject({ status: 412 });
  });
});
