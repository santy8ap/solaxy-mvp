import "server-only";
import { mercadoPagoConfig } from "./config";

/** Lo que importa de la cuenta dueña del Access Token (GET /users/me). */
export interface MpAccount {
  testUser: boolean;
  siteId: string | null;
  nickname: string | null;
}

/** Cuánto se recuerda la respuesta: 6 horas, o 1 minuto si Mercado Pago no respondió. */
const FRESH_MS = 6 * 60 * 60_000;
const RETRY_MS = 60_000;

const g = globalThis as unknown as { __iweMpAccount?: { token: string; at: number; ttl: number; account: MpAccount | null } };

/**
 * La cuenta de Mercado Pago del Access Token, consultada una vez y recordada.
 * Devuelve null si no hay credenciales o si Mercado Pago no respondió.
 */
export async function mercadoPagoAccount(deps: { fetch?: typeof fetch } = {}): Promise<MpAccount | null> {
  const cfg = mercadoPagoConfig();
  if (!cfg.enabled) return null;
  const cached = g.__iweMpAccount;
  if (cached && cached.token === cfg.accessToken && Date.now() - cached.at < cached.ttl) return cached.account;
  let account: MpAccount | null = null;
  try {
    const res = await (deps.fetch ?? fetch)(`${cfg.apiBase}/users/me`, {
      headers: { authorization: `Bearer ${cfg.accessToken}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (res.ok) {
      const me = (await res.json()) as { tags?: unknown; site_id?: string; nickname?: string };
      account = { testUser: Array.isArray(me.tags) && me.tags.includes("test_user"), siteId: me.site_id ?? null, nickname: me.nickname ?? null };
    }
  } catch {
    /* sin respuesta: se vuelve a intentar en un minuto */
  }
  g.__iweMpAccount = { token: cfg.accessToken, at: Date.now(), ttl: account ? FRESH_MS : RETRY_MS, account };
  return account;
}

/**
 * ¿Las credenciales son de prueba (no cobran dinero real)? Las antiguas empiezan por TEST-. Las nuevas empiezan
 * por APP_USR-, igual que las de producción: solo Mercado Pago sabe que la cuenta es de prueba.
 */
export async function isMercadoPagoTest(deps: { fetch?: typeof fetch } = {}) {
  const cfg = mercadoPagoConfig();
  if (!cfg.enabled) return false;
  if (cfg.sandbox) return true;
  return (await mercadoPagoAccount(deps))?.testUser ?? false;
}
