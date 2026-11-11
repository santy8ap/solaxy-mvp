import "server-only";
import { mercadoPagoConfig } from "./config";

/** Cuánto recibe Mercado Pago en un solo pago, por tipo de medio (COP). */
export interface MpLimits {
  /** Tope de las tarjetas de crédito, débito y prepago */
  cardMaxCop: number;
  /** Tope de PSE (Nequi y Daviplata se pagan por PSE, con sus propios topes) */
  pseMaxCop: number;
}

/**
 * Topes de Mercado Pago Colombia según GET /v1/payment_methods, consultado el 11 de noviembre de 2026.
 * Se usan si Mercado Pago no responde. Cada banco puede tener un tope menor para sus clientes.
 */
export const DEFAULT_MP_LIMITS: MpLimits = { cardMaxCop: 50_000_000, pseMaxCop: 340_000_000 };

const CARD_TYPES = new Set(["credit_card", "debit_card", "prepaid_card"]);

interface MpMethod {
  id?: string;
  payment_type_id?: string;
  status?: string;
  max_allowed_amount?: number | null;
}

/** Los topes a partir de la lista de medios de pago de Mercado Pago. Lo que falte usa el valor conocido. */
export function limitsFromMethods(methods: readonly MpMethod[] | null | undefined): MpLimits {
  let card = 0;
  let pse = 0;
  for (const m of methods ?? []) {
    const max = Number(m.max_allowed_amount);
    if (m.status !== "active" || !Number.isFinite(max) || max <= 0) continue;
    if (CARD_TYPES.has(m.payment_type_id ?? "")) card = Math.max(card, max);
    else if (m.payment_type_id === "bank_transfer") pse = Math.max(pse, max);
  }
  return { cardMaxCop: card || DEFAULT_MP_LIMITS.cardMaxCop, pseMaxCop: pse || DEFAULT_MP_LIMITS.pseMaxCop };
}

/**
 * Qué se puede usar en Mercado Pago para pagar `amountCop`: si se puede pagar allí, y si las tarjetas alcanzan.
 * Por encima del tope de las tarjetas solo queda PSE; por encima del de PSE, Mercado Pago no recibe el pago.
 */
export function mercadoPagoFor(amountCop: number, limits: MpLimits) {
  const available = amountCop <= limits.pseMaxCop;
  return { available, cards: available && amountCop <= limits.cardMaxCop };
}

/** Cuánto se recuerda la respuesta: 6 horas, o 1 minuto si Mercado Pago no respondió. */
const FRESH_MS = 6 * 60 * 60_000;
const RETRY_MS = 60_000;

const g = globalThis as unknown as { __iweMpLimits?: { token: string; at: number; ttl: number; limits: MpLimits } };

/** Los topes vigentes, consultados a Mercado Pago y recordados. Sin credenciales o sin respuesta, los conocidos. */
export async function mercadoPagoLimits(deps: { fetch?: typeof fetch } = {}): Promise<MpLimits> {
  const cfg = mercadoPagoConfig();
  if (!cfg.enabled) return DEFAULT_MP_LIMITS;
  const cached = g.__iweMpLimits;
  if (cached && cached.token === cfg.accessToken && Date.now() - cached.at < cached.ttl) return cached.limits;
  let limits: MpLimits | null = null;
  try {
    const res = await (deps.fetch ?? fetch)(`${cfg.apiBase}/v1/payment_methods`, {
      headers: { authorization: `Bearer ${cfg.accessToken}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (res.ok) {
      const json = (await res.json()) as unknown;
      if (Array.isArray(json)) limits = limitsFromMethods(json as MpMethod[]);
    }
  } catch {
    /* sin respuesta: se vuelve a intentar en un minuto */
  }
  g.__iweMpLimits = { token: cfg.accessToken, at: Date.now(), ttl: limits ? FRESH_MS : RETRY_MS, limits: limits ?? DEFAULT_MP_LIMITS };
  return limits ?? DEFAULT_MP_LIMITS;
}
