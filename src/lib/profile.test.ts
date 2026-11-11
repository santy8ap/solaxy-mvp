import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-profile-")), "test.db")}`;

let profile: typeof import("@/lib/profile");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");

beforeAll(async () => {
  profile = await import("@/lib/profile");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  for (const id of ["inv-010", "inv-011", "inv-012", "inv-013", "inv-014", "inv-015", "inv-016", "inv-017", "inv-018"]) await createUser(id, { profile: false });
}, 120_000);

const input = { companyName: "Energía Andina S.A.S.", nit: "900.123.456-8", fullName: "Laura Gómez", docType: "CC", docNumber: "1.036.123.456", phone: "300 123 4567", city: "Medellín", acceptTerms: true };

const personal = { fullName: "Laura Gómez", docType: "CC", docNumber: "1.036.123.456", phone: "300 123 4567", city: "Medellín", acceptTerms: true };

describe("datos del comercializador", () => {
  it("guarda un perfil personal y permite continuar al pago sin razón social ni NIT", async () => {
    const saved = await profile.saveProfile("inv-016", personal);
    expect(saved).toMatchObject({ companyName: "", nit: "", fullName: "Laura Gómez", docNumber: "1036123456", complete: true });
    await expect(profile.requireCompleteProfile("inv-016")).resolves.toEqual(saved);
  });

  it("conserva los datos históricos al actualizar únicamente la identidad personal", async () => {
    await profile.saveProfile("inv-017", input);
    const saved = await profile.saveProfile("inv-017", { ...personal, city: "Envigado" });
    expect(saved).toMatchObject({ companyName: input.companyName, nit: "900123456-8", city: "Envigado", complete: true });
  });

  it("no deja comprar con datos personales incompletos aunque los términos estén vigentes", async () => {
    await profile.saveProfile("inv-018", personal);
    await dbMod.db.update(schema.companyProfile).set({ phone: "" }).where(drizzle.eq(schema.companyProfile.userId, "inv-018"));
    await expect(profile.requireCompleteProfile("inv-018")).rejects.toMatchObject({ status: 412, extra: { code: "perfil_incompleto" } });
  });
  it("guarda los datos normalizados con la versión de los términos y la fecha", async () => {
    const before = Date.now();
    const p = await profile.saveProfile("inv-010", input);
    expect(p).toMatchObject({ companyName: "Energía Andina S.A.S.", nit: "900123456-8", fullName: "Laura Gómez", docNumber: "1036123456", phone: "3001234567", termsVersion: profile.TERMS_VERSION, complete: true });
    expect(p.termsAcceptedAt).toBeGreaterThanOrEqual(before);
    expect(await profile.getProfile("inv-010")).toEqual(p);
  });

  it("al actualizar conserva la fecha de creación", async () => {
    const first = await profile.saveProfile("inv-011", input);
    const second = await profile.saveProfile("inv-011", { ...input, city: "Envigado" });
    expect(second.city).toBe("Envigado");
    const [row] = await dbMod.db.select().from(schema.companyProfile).where(drizzle.eq(schema.companyProfile.userId, "inv-011"));
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
    await dbMod.db.update(schema.companyProfile).set({ termsVersion: "2020-01-01" }).where(drizzle.eq(schema.companyProfile.userId, "inv-014"));
    expect((await profile.getProfile("inv-014"))?.complete).toBe(false);
    await expect(profile.requireCompleteProfile("inv-014")).rejects.toMatchObject({ status: 412 });
  });

  it("reconoce perfiles personales anteriores sin exigirles datos de empresa", async () => {
    const now = Date.now();
    await dbMod.db.insert(schema.companyProfile).values({ userId: "inv-015", companyName: "", nit: "", fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", termsVersion: profile.TERMS_VERSION, termsAcceptedAt: now, createdAt: now, updatedAt: now });
    expect((await profile.getProfile("inv-015"))?.complete).toBe(true);
    await expect(profile.requireCompleteProfile("inv-015")).resolves.toMatchObject({ fullName: "Laura Gómez", complete: true });
  });
});
