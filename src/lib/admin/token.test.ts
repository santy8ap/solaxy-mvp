import { describe, expect, it } from "vitest";
import { createPinLimiter, pinMatches, sessionBinding, signAdminToken, verifyAdminToken } from "@/lib/admin/token";

const SECRET = "secreto-de-prueba-suficientemente-largo";
const now = Date.UTC(2026, 10, 4, 0, 0);
const binding = sessionBinding("token-de-sesion-A");

describe("cookie de administrador", () => {
  it("es válida para el mismo usuario y la misma sesión antes de vencer", () => {
    const t = signAdminToken({ userId: "u1", binding, exp: now + 60_000 }, SECRET);
    expect(verifyAdminToken(t, { userId: "u1", binding, now }, SECRET)).toBe(true);
  });

  it("no sirve en otra sesión", () => {
    const t = signAdminToken({ userId: "u1", binding, exp: now + 60_000 }, SECRET);
    expect(verifyAdminToken(t, { userId: "u1", binding: sessionBinding("token-de-sesion-B"), now }, SECRET)).toBe(false);
  });

  it("no sirve para otro usuario", () => {
    const t = signAdminToken({ userId: "u1", binding, exp: now + 60_000 }, SECRET);
    expect(verifyAdminToken(t, { userId: "u2", binding, now }, SECRET)).toBe(false);
  });

  it("vence", () => {
    const t = signAdminToken({ userId: "u1", binding, exp: now + 60_000 }, SECRET);
    expect(verifyAdminToken(t, { userId: "u1", binding, now: now + 60_001 }, SECRET)).toBe(false);
  });

  it("detecta si fue alterada o firmada con otra clave", () => {
    const t = signAdminToken({ userId: "u1", binding, exp: now + 60_000 }, SECRET);
    const tampered = t.replace(/.$/, (c) => (c === "a" ? "b" : "a"));
    expect(verifyAdminToken(tampered, { userId: "u1", binding, now }, SECRET)).toBe(false);
    expect(verifyAdminToken(t, { userId: "u1", binding, now }, "otra-clave")).toBe(false);
  });

  it("rechaza valores vacíos o basura sin lanzar error", () => {
    expect(verifyAdminToken(undefined, { userId: "u1", binding, now }, SECRET)).toBe(false);
    expect(verifyAdminToken("basura", { userId: "u1", binding, now }, SECRET)).toBe(false);
  });
});

describe("PIN de administrador", () => {
  it("compara el PIN sin importar mayúsculas ni espacios alrededor", () => {
    expect(pinMatches(" 2026 ", "2026")).toBe(true);
    expect(pinMatches("2025", "2026")).toBe(false);
    expect(pinMatches("20266", "2026")).toBe(false);
    expect(pinMatches("", "2026")).toBe(false);
  });

  it("bloquea después de 5 intentos fallidos y se libera al pasar la ventana", () => {
    const limiter = createPinLimiter({ max: 5, windowMs: 10 * 60_000 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow("ip-1", now)).toBe(true);
      limiter.fail("ip-1", now);
    }
    expect(limiter.allow("ip-1", now + 1000)).toBe(false);
    expect(limiter.allow("ip-2", now + 1000)).toBe(true);
    expect(limiter.allow("ip-1", now + 10 * 60_000 + 1)).toBe(true);
  });

  it("un acierto reinicia el contador", () => {
    const limiter = createPinLimiter({ max: 2, windowMs: 60_000 });
    limiter.fail("ip", now);
    limiter.reset("ip");
    limiter.fail("ip", now);
    expect(limiter.allow("ip", now)).toBe(true);
  });
});

describe("PIN de administrador: 5 intentos y esperar un minuto (contado en la base)", () => {
  it("bloquea al sexto intento, aunque el PIN sea correcto, y se libera al minuto", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { createDb } = await import("@/lib/db/client");
    const { migrate } = await import("@/lib/db/migrate");
    const { client } = createDb(`file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-pin-")), "pin.db")}`);
    await migrate(client, { localFile: true });
    const { verifyPinAttempt } = await import("@/lib/admin/pin-attempts");
    const t = 10_000_000;
    const keys = ["usuario:u1", "ip:203.0.113.5"];
    for (let i = 0; i < 5; i++) {
      expect(await verifyPinAttempt({ pin: "000000", expected: "481516", keys, now: t + i }, client)).toMatchObject({ ok: false, locked: false });
    }
    const sixth = await verifyPinAttempt({ pin: "481516", expected: "481516", keys, now: t + 10 }, client);
    expect(sixth).toMatchObject({ ok: false, locked: true });
    // Otra cuenta desde otra IP no se ve afectada.
    expect(await verifyPinAttempt({ pin: "481516", expected: "481516", keys: ["usuario:u2", "ip:203.0.113.9"], now: t + 10 }, client)).toMatchObject({ ok: true });
    // Pasado un minuto desde el bloqueo, vuelve a dejar intentar.
    expect(await verifyPinAttempt({ pin: "481516", expected: "481516", keys, now: t + 10 + 60_001 }, client)).toMatchObject({ ok: true });
  });

  it("un acierto borra los fallos de esa cuenta", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { createDb } = await import("@/lib/db/client");
    const { migrate } = await import("@/lib/db/migrate");
    const { client } = createDb(`file:${path.join(mkdtempSync(path.join(tmpdir(), "iwe-pin-")), "pin.db")}`);
    await migrate(client, { localFile: true });
    const { verifyPinAttempt } = await import("@/lib/admin/pin-attempts");
    const keys = ["usuario:u1", "ip:203.0.113.5"];
    const t = 20_000_000;
    for (let i = 0; i < 4; i++) await verifyPinAttempt({ pin: "1", expected: "481516", keys, now: t + i }, client);
    expect(await verifyPinAttempt({ pin: "481516", expected: "481516", keys, now: t + 5 }, client)).toMatchObject({ ok: true });
    for (let i = 0; i < 4; i++) {
      expect(await verifyPinAttempt({ pin: "1", expected: "481516", keys: ["usuario:u1", "ip:203.0.113.6"], now: t + 10 + i }, client)).toMatchObject({ locked: false });
    }
  });
});
