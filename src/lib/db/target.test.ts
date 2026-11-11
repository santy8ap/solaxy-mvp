import { describe, expect, it } from "vitest";
import { databaseTarget, hasOwnPreviewDatabase } from "@/lib/db/target";

const PROD = { TURSO_DATABASE_URL: "libsql://solaxy.turso.io", TURSO_AUTH_TOKEN: "token-produccion" };
const PREVIEW = { PREVIEW_TURSO_DATABASE_URL: "libsql://solaxy-preview.turso.io", PREVIEW_TURSO_AUTH_TOKEN: "token-pruebas" };

describe("a qué base se conecta cada ejecución", () => {
  it("producción usa la base principal con su token", () => {
    expect(databaseTarget({ VERCEL: "1", VERCEL_ENV: "production", ...PROD, ...PREVIEW })).toEqual({ url: PROD.TURSO_DATABASE_URL, authToken: "token-produccion", kind: "principal" });
  });

  it("una vista previa usa su propia base aunque tenga a mano la de producción", () => {
    const t = databaseTarget({ VERCEL: "1", VERCEL_ENV: "preview", ...PROD, ...PREVIEW });
    expect(t).toEqual({ url: PREVIEW.PREVIEW_TURSO_DATABASE_URL, authToken: "token-pruebas", kind: "pruebas" });
    expect(hasOwnPreviewDatabase({ VERCEL_ENV: "preview", ...PREVIEW })).toBe(true);
  });

  it("una vista previa sin base propia nunca cae en la de producción: usa un archivo temporal", () => {
    const t = databaseTarget({ VERCEL: "1", VERCEL_ENV: "preview", ...PROD, PREVIEW_TURSO_DATABASE_URL: "  " });
    expect(t).toEqual({ url: "file:/tmp/iwe-preview.db", kind: "temporal" });
    expect(t.authToken).toBeUndefined();
    expect(hasOwnPreviewDatabase({ VERCEL_ENV: "preview", ...PROD })).toBe(false);
  });

  it("fuera de una vista previa, la base de pruebas no se usa", () => {
    expect(databaseTarget({ ...PREVIEW })).toEqual({ url: "file:./data/iwe.db", kind: "local" });
    expect(hasOwnPreviewDatabase({ VERCEL_ENV: "production", ...PREVIEW })).toBe(false);
  });

  it("en tu computador: DATABASE_URL o el archivo local; en Vercel sin Turso, un archivo temporal", () => {
    expect(databaseTarget({ DATABASE_URL: "file:./otra.db" })).toEqual({ url: "file:./otra.db", kind: "local" });
    expect(databaseTarget({})).toEqual({ url: "file:./data/iwe.db", kind: "local" });
    expect(databaseTarget({ VERCEL: "1", VERCEL_ENV: "production" })).toEqual({ url: "file:/tmp/iwe.db", kind: "temporal" });
  });
});
