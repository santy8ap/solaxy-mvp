import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { BRAND } from "@/config/brand";
import { db } from "@/lib/db";
import { companyProfile, user } from "@/lib/db/schema";
import { adminEmails, baseUrl, env, isDemoMode } from "@/lib/env";
import { formatCop, formatDateTime } from "@/lib/format";
import { createDbRateLimiter } from "@/lib/security/db-rate-limit";
import { transferReference } from "@/lib/transfer-reference";

/**
 * Alertas por correo para el administrador, enviadas con Resend (resend.com).
 *
 * - Sin RESEND_API_KEY no se envía nada.
 * - Van a ALERT_EMAIL (uno o varios, separados por comas) o, si no está, a los correos de ADMIN_EMAILS.
 * - Sin dominio propio, Resend solo entrega desde onboarding@resend.dev y al correo de la cuenta de Resend.
 *   Con un dominio verificado, ALERT_FROM cambia el remitente.
 * - Nunca demoran una respuesta ni rompen una operación: se envían después de responder, y si fallan
 *   solo queda el registro en los logs.
 */

const RESEND_URL = "https://api.resend.com/emails";
const MAX_RECIPIENTS = 5;
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export interface AlertConfig {
  enabled: boolean;
  to: string[];
  from: string;
}

export function alertConfig(): AlertConfig {
  const list = (v: string | undefined) =>
    (v ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => EMAIL.test(e));
  const explicit = list(process.env.ALERT_EMAIL);
  // La cuenta de pruebas está en ADMIN_EMAILS solo para entrar al admin: no recibe correos.
  const to = (explicit.length ? explicit : adminEmails().filter((e) => EMAIL.test(e) && e !== env.demoEmail)).slice(0, MAX_RECIPIENTS);
  return {
    enabled: Boolean(process.env.RESEND_API_KEY?.trim()) && to.length > 0,
    to,
    from: process.env.ALERT_FROM?.trim() || `${BRAND.name} <onboarding@resend.dev>`,
  };
}

export type AlertKind = "pago" | "pago_por_devolver" | "transferencia" | "retiro" | "devolucion" | "datos" | "falla" | "prueba";

export interface Alert {
  kind: AlertKind;
  subject: string;
  /** Párrafos del mensaje, en texto plano (se escapan al armar el HTML) */
  lines: string[];
  /** Página del admin donde se atiende, p. ej. /admin/pagos */
  path?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function appUrl() {
  try {
    return baseUrl();
  } catch {
    return null;
  }
}

/** Asunto, texto y HTML del correo. Todo lo que viene de los usuarios va escapado. */
export function renderAlert(alert: Alert, { demo = isDemoMode(), url = appUrl() }: { demo?: boolean; url?: string | null } = {}) {
  const subject = `${demo ? "[Pruebas] " : ""}${alert.subject}`.replace(/[\r\n]+/g, " ").slice(0, 180);
  const link = alert.path && url ? `${url}${alert.path}` : null;
  const footer = demo ? "La página está en modo de pruebas: los pagos de este ambiente no son dinero real." : null;
  const text = [...alert.lines, link ? `Ábrelo en el admin: ${link}` : null, footer, `— ${BRAND.name}`].filter(Boolean).join("\n\n");
  const p = (s: string, muted = false) => `<p style="margin:0 0 14px;${muted ? "color:#666;" : ""}">${escapeHtml(s)}</p>`;
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">',
    ...alert.lines.map((l) => p(l)),
    link ? `<p style="margin:0 0 14px"><a href="${escapeHtml(link)}" style="color:#111">Abrir en el admin</a></p>` : "",
    footer ? p(footer, true) : "",
    p(`— ${BRAND.name}`, true),
    "</div>",
  ].join("");
  return { subject, text, html };
}

export interface Delivery {
  to: string;
  ok: boolean;
  error?: string;
}

/** Envía la alerta ya, un correo por destinatario. Devuelve cómo le fue a cada uno; nunca lanza errores. */
export async function deliverAlert(alert: Alert, deps: { fetch?: typeof fetch; config?: AlertConfig } = {}): Promise<Delivery[]> {
  const cfg = deps.config ?? alertConfig();
  const key = process.env.RESEND_API_KEY?.trim();
  if (!cfg.enabled || !key) return [];
  const { subject, text, html } = renderAlert(alert);
  const results: Delivery[] = [];
  for (const to of cfg.to) {
    try {
      const res = await (deps.fetch ?? fetch)(RESEND_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: cfg.from, to: [to], subject, text, html }),
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
      if (res.ok) {
        results.push({ to, ok: true });
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: unknown };
        results.push({ to, ok: false, error: `${res.status}: ${String(body.message ?? res.statusText).slice(0, 300)}` });
      }
    } catch (err) {
      results.push({ to, ok: false, error: String(err).slice(0, 200) });
    }
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length && !process.env.VITEST)
    console.error(JSON.stringify({ tipo: "alerta", accion: "no_enviada", alerta: alert.kind, errores: failed.map((f) => f.error) }));
  return results;
}

const g = globalThis as unknown as { __iweAlertTasks?: Set<Promise<void>>; __iweAlertSeen?: Map<string, number> };

/**
 * Programa una alerta para después de responder. `build` arma el mensaje (puede consultar la base)
 * fuera del camino del usuario; si devuelve null, no se envía nada.
 */
export function alertAdmin(build: () => Alert | null | Promise<Alert | null>) {
  if (!alertConfig().enabled) return;
  const task = async () => {
    try {
      const alert = await build();
      if (alert) await deliverAlert(alert);
    } catch (err) {
      if (!process.env.VITEST) console.error(JSON.stringify({ tipo: "alerta", accion: "fallida", error: String(err).slice(0, 200) }));
    }
  };
  try {
    after(task);
  } catch {
    // Fuera de una petición (pruebas o scripts): se envía de una vez.
    const p = task();
    const tasks = (g.__iweAlertTasks ??= new Set());
    tasks.add(p);
    void p.finally(() => tasks.delete(p));
  }
}

/** Para las pruebas: espera las alertas que se enviaron fuera de una petición. */
export async function flushAlerts() {
  await Promise.all([...(g.__iweAlertTasks ?? [])]);
}

/* ───────────── Mensajes ───────────── */

interface PaymentLike {
  id: string;
  userId: string;
  amountCop: number;
  method: string | null;
  periodIndex: number | null;
  subscriptionId: string | null;
  note?: string | null;
  txHash?: string | null;
}

interface WithdrawalLike {
  id: string;
  userId: string;
  amountCop: number;
  bankName: string | null;
}

const METHOD: Record<string, string> = {
  mercadopago: "Mercado Pago",
  crypto: "cripto",
  transferencia: "transferencia bancaria",
  manual: "un pago registrado a mano",
  demo: "el pago de prueba",
};
const methodName = (m: string | null) => (m && METHOD[m]) || "otro medio";
const monthOf = (p: PaymentLike) => (p.periodIndex ? `el mes ${p.periodIndex} de su plan` : "un mes de su plan");

function deployment() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return `${process.env.VERCEL_ENV ?? "local"}${sha ? ` (${sha})` : ""}`;
}

/**
 * El detalle técnico de una falla, sin datos personales: un error de la base trae los valores de la consulta
 * ("params: …"), que pueden ser nombres, correos, documentos o cuentas bancarias. Esos no viajan por correo;
 * el error completo queda en los registros de Vercel.
 */
export function redactFailureDetail(detail: string) {
  return detail
    .replace(/\bparams:[\s\S]*/i, "params: [omitidos]")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[correo]");
}

export const alertMessages = {
  paymentConfirmed: (p: PaymentLike, who: string): Alert => ({
    kind: "pago",
    subject: `Entró un pago de ${formatCop(p.amountCop)}`,
    lines: [`${who} pagó ${monthOf(p)} con ${methodName(p.method)}. El mes ya está activo y su energía empezó a contar.`, `Orden ${p.id}.`],
    path: "/admin/pagos",
  }),
  paymentToRefund: (p: PaymentLike, who: string): Alert => ({
    kind: "pago_por_devolver",
    subject: `Hay que devolver un pago de ${formatCop(p.amountCop)}`,
    lines: [
      `Llegó un pago de ${who} con ${methodName(p.method)}, pero no activó el mes.${p.note ? ` ${p.note}` : ""}`,
      `Devuélvelo y márcalo como reembolsado en Pagos. Orden ${p.id}.`,
    ],
    path: "/admin/pagos",
  }),
  transferReported: (p: PaymentLike, who: string): Alert => ({
    kind: "transferencia",
    subject: `Transferencia por confirmar: ${formatCop(p.amountCop)}`,
    lines: [
      `${who} avisó que transfirió ${formatCop(p.amountCop)} para ${monthOf(p)}.`,
      `Búscala en el banco con la referencia ${p.subscriptionId && p.periodIndex ? transferReference(p.subscriptionId, p.periodIndex) : p.id}${p.txHash ? ` y el comprobante ${p.txHash}` : ""}. Si llegó, confírmala en Pagos; si no, márcala como "No llegó".`,
    ],
    path: "/admin/pagos",
  }),
  withdrawalRequested: (w: WithdrawalLike, who: string): Alert => ({
    kind: "retiro",
    subject: `Retiro por aprobar: ${formatCop(w.amountCop)}`,
    lines: [
      `${who} pidió un retiro de ${formatCop(w.amountCop)} ${w.bankName ? `a su cuenta de ${w.bankName}` : "a su wallet"}.`,
      `El saldo queda apartado hasta que lo pagues o lo rechaces en Retiros. Retiro ${w.id}.`,
    ],
    path: "/admin/retiros",
  }),
  reversal: (p: PaymentLike, who: string, providerStatus: string, stoppedEnergy: boolean): Alert => ({
    kind: "devolucion",
    subject: `Mercado Pago devolvió un pago de ${formatCop(p.amountCop)}`,
    lines: [
      `El pago ${p.id} de ${who} quedó devuelto o desconocido en Mercado Pago (estado: ${providerStatus}).`,
      stoppedEnergy
        ? "Ese mes dejó de generar energía, y la cuenta no puede retirar hasta que registres la conciliación en Pagos."
        : "Ese pago no había activado energía.",
    ],
    path: "/admin/pagos",
  }),
  failure: (title: string, detail: string, at = Date.now()): Alert => ({
    kind: "falla",
    subject: `Algo falló: ${title}`,
    lines: [redactFailureDetail(detail).slice(0, 400), `Cuándo: ${formatDateTime(at)}. Despliegue: ${deployment()}.`, "Los detalles están en Vercel › Logs."],
  }),
  test: (): Alert => ({
    kind: "prueba",
    subject: "Prueba de las alertas por correo",
    lines: [
      "Si lees esto, las alertas por correo funcionan.",
      "Te escribimos cuando entra un pago, cuando un comercializador reporta una transferencia, cuando alguien pide un retiro, cuando Mercado Pago devuelve un pago y cuando algo falla en el servidor.",
    ],
    path: "/admin",
  }),
};

/** El nombre con que el admin reconoce al cliente: la empresa, el titular o el nombre de la cuenta. */
async function customerName(userId: string) {
  const [row] = await db
    .select({ name: user.name, company: companyProfile.companyName, fullName: companyProfile.fullName })
    .from(user)
    .leftJoin(companyProfile, eq(companyProfile.userId, user.id))
    .where(eq(user.id, userId));
  return row?.company || row?.fullName || row?.name || "Un cliente";
}

/* ───────────── Cuándo se envían ───────────── */

/** Entró un pago por Mercado Pago o cripto. Las transferencias y los pagos a mano los confirma el propio admin. */
export function alertPaymentConfirmed(p: PaymentLike) {
  if (p.method !== "mercadopago" && p.method !== "crypto") return;
  alertAdmin(async () => alertMessages.paymentConfirmed(p, await customerName(p.userId)));
}

/** Llegó dinero que no activó el mes: hay que devolverlo. */
export function alertPaymentToRefund(p: PaymentLike) {
  if (p.method === "demo") return;
  alertAdmin(async () => alertMessages.paymentToRefund(p, await customerName(p.userId)));
}

export function alertTransferReported(p: PaymentLike) {
  alertAdmin(async () => alertMessages.transferReported(p, await customerName(p.userId)));
}

export function alertWithdrawalRequested(w: WithdrawalLike) {
  alertAdmin(async () => alertMessages.withdrawalRequested(w, await customerName(w.userId)));
}

export function alertReversal(p: PaymentLike, providerStatus: string, stoppedEnergy: boolean) {
  alertAdmin(async () => alertMessages.reversal(p, await customerName(p.userId), providerStatus, stoppedEnergy));
}

/** Una misma falla avisa como mucho una vez cada 15 minutos, y todas juntas, 6 veces por hora. */
const FAILURE_WINDOW_MS = 15 * 60_000;
const failureLimiter = createDbRateLimiter({ name: "alerta-falla", max: 1, windowMs: FAILURE_WINDOW_MS });
const failureCap = createDbRateLimiter({ name: "alerta-fallas", max: 6, windowMs: 60 * 60_000 });

/** Algo falló en el servidor. `key` agrupa las repeticiones de la misma falla. */
export function alertFailure(key: string, title: string, detail: string) {
  if (!alertConfig().enabled) return;
  // Primero en memoria (esta instancia), luego en la base (todas las instancias).
  const seen = (g.__iweAlertSeen ??= new Map());
  const now = Date.now();
  if (now - (seen.get(key) ?? 0) < FAILURE_WINDOW_MS) return;
  seen.set(key, now);
  alertAdmin(async () => {
    if (!(await failureLimiter.hit(key.slice(0, 120), now)) || !(await failureCap.hit("todas", now))) return null;
    return alertMessages.failure(title, detail, now);
  });
}
