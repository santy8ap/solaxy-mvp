import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cookie de administrador: `userId.binding.vencimiento.firma` en base64url.
 * `binding` es un hash del token de la sesión, así la cookie solo sirve en la
 * sesión donde se ingresó el PIN.
 */
export function sessionBinding(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("base64url").slice(0, 32);
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function hmac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signAdminToken(p: { userId: string; binding: string; exp: number }, secret: string) {
  const payload = `${b64(p.userId)}.${p.binding}.${p.exp}`;
  return `${payload}.${hmac(payload, secret)}`;
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyAdminToken(
  token: string | undefined,
  expect: { userId: string; binding: string; now: number },
  secret: string,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [user, binding, exp, sig] = parts;
  const payload = `${user}.${binding}.${exp}`;
  if (!safeEqual(sig, hmac(payload, secret))) return false;
  let userId: string;
  try {
    userId = unb64(user);
  } catch {
    return false;
  }
  return userId === expect.userId && binding === expect.binding && Number(exp) > expect.now;
}

/** Compara el PIN en tiempo constante (sobre sus hashes). */
export function pinMatches(input: string, expected: string) {
  const a = createHash("sha256").update(String(input ?? "").trim()).digest();
  const b = createHash("sha256").update(String(expected ?? "").trim()).digest();
  return String(input ?? "").trim().length > 0 && timingSafeEqual(a, b);
}

/** Límite de intentos fallidos de PIN por clave (por ejemplo, la IP). */
export function createPinLimiter({ max = 5, windowMs = 10 * 60_000 } = {}) {
  const fails = new Map<string, number[]>();
  const recent = (key: string, now: number) => (fails.get(key) ?? []).filter((t) => now - t < windowMs);
  return {
    allow(key: string, now: number) {
      const r = recent(key, now);
      fails.set(key, r);
      return r.length < max;
    },
    fail(key: string, now: number) {
      fails.set(key, [...recent(key, now), now]);
    },
    reset(key: string) {
      fails.delete(key);
    },
  };
}
