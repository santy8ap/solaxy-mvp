import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { after } from "next/server";
import { BRAND } from "@/config/brand";
import { db } from "@/lib/db";
import { writeTransaction } from "@/lib/db/transaction";
import { companyProfile, customerEmail, planPeriod, user } from "@/lib/db/schema";
import { isDeletedEmail } from "@/lib/deleted-account";
import { baseUrl, env, isDemoMode } from "@/lib/env";
import { formatCop, formatDate } from "@/lib/format";
import { planCheckoutHref, renewalCheckoutHref } from "@/lib/navigation";
import { getSupport } from "@/lib/support";

/**
 * Correos al comercializador: pago confirmado, pago por devolver o devuelto, transferencia no confirmada, retiro
 * pagado o rechazado, mensualidad por vencer, plan en pausa o por terminar, y la respuesta a sus solicitudes
 * sobre sus datos. Se envían con Resend, como las alertas del admin.
 *
 * - Apagados hasta configurar CUSTOMER_EMAIL_FROM con un remitente de un dominio verificado en Resend: sin
 *   dominio, Resend solo entrega al correo del dueño de la cuenta, nunca a un cliente.
 * - Cada aviso tiene una clave (p. ej. «pago:XGE-…»): el mismo nunca se envía dos veces, y uno que falló se
 *   reintenta hasta 3 veces. Queda constancia en la tabla customer_email (sin la dirección de destino).
 * - Nunca demoran una respuesta ni rompen una operación: se envían después de responder.
 * - No van a la cuenta de pruebas ni a las cuentas eliminadas.
 */

const RESEND_URL = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 3;
const SENDER = /^(?:[^<>@]{1,60}<)?([^\s@<>]+@([^\s@<>]+\.[a-z]{2,}))>?$/i;
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export interface CustomerEmailConfig {
  enabled: boolean;
  from: string | null;
  /** Por qué está apagado, en palabras del admin */
  reason: string | null;
}

export function customerEmailConfig(): CustomerEmailConfig {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CUSTOMER_EMAIL_FROM?.trim() ?? "";
  const domain = SENDER.exec(from)?.[2]?.toLowerCase();
  if (!key) return { enabled: false, from: null, reason: "Falta la clave de Resend (RESEND_API_KEY)." };
  if (!from) return { enabled: false, from: null, reason: "Falta el remitente (CUSTOMER_EMAIL_FROM), de un dominio verificado en Resend." };
  if (!domain) return { enabled: false, from: null, reason: "CUSTOMER_EMAIL_FROM no es un remitente válido. Ejemplo: X green Energy <avisos@tudominio.co>." };
  if (domain === "resend.dev") return { enabled: false, from: null, reason: "El remitente de pruebas de Resend (resend.dev) no entrega a los clientes: verifica tu dominio en Resend." };
  return { enabled: true, from, reason: null };
}

export interface CustomerMessage {
  /** Identifica el aviso: el mismo nunca se envía dos veces */
  key: string;
  kind: string;
  subject: string;
  /** Párrafos del mensaje, en texto plano (se escapan al armar el HTML) */
  lines: string[];
  /** Botón a una página del sitio, p. ej. «Abrir mi panel» → /panel */
  cta?: { label: string; path: string };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** El primer nombre, para el saludo. */
export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0]?.slice(0, 40) ?? "";

/** Asunto, texto y HTML del correo. Todo lo que viene de las personas va escapado. */
export function renderCustomerEmail(
  m: CustomerMessage,
  { name, demo = isDemoMode(), url = baseUrl(), support = null }: { name?: string | null; demo?: boolean; url?: string; support?: string | null } = {},
) {
  const subject = `${demo ? "[Pruebas] " : ""}${m.subject}`.replace(/[\r\n]+/g, " ").slice(0, 160);
  const hello = firstName(name) ? `Hola, ${firstName(name)}:` : "Hola:";
  const link = m.cta ? `${url}${m.cta.path}` : null;
  const help = support ? `Si tienes preguntas, escríbenos a ${support}.` : "Si tienes preguntas, responde a este correo.";
  const footer = `Recibes este correo porque tienes una cuenta en ${BRAND.name}.${demo ? " La página está en modo de pruebas: estos pagos no son dinero real." : ""}`;
  const text = [hello, ...m.lines, link ? `${m.cta!.label}: ${link}` : null, help, `— ${BRAND.name}`, footer].filter(Boolean).join("\n\n");
  const p = (s: string, muted = false) => `<p style="margin:0 0 14px;${muted ? "color:#666;font-size:13px;" : ""}">${escapeHtml(s)}</p>`;
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">',
    p(hello),
    ...m.lines.map((l) => p(l)),
    link
      ? `<p style="margin:22px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 18px;border:1px solid #111;color:#111;text-decoration:none;font-weight:600">${escapeHtml(m.cta!.label)}</a></p>`
      : "",
    p(help),
    p(`— ${BRAND.name}`),
    p(footer, true),
    "</div>",
  ].join("");
  return { subject, text, html };
}

/** A quién va: el correo de la cuenta y su nombre. Nunca a la cuenta de pruebas ni a una cuenta eliminada. */
async function recipientOf(userId: string) {
  const [row] = await db
    .select({ email: user.email, name: user.name, fullName: companyProfile.fullName })
    .from(user)
    .leftJoin(companyProfile, eq(companyProfile.userId, user.id))
    .where(eq(user.id, userId));
  if (!row || !EMAIL.test(row.email) || isDeletedEmail(row.email) || row.email.toLowerCase() === env.demoEmail) return null;
  return { email: row.email, name: row.fullName || row.name };
}

/**
 * Reserva el aviso: true si hay que enviarlo (nuevo, o falló antes y quedan intentos). Va en una transacción de
 * escritura para esperar su turno: el aviso suele salir justo cuando la operación que lo causó escribe en la
 * bitácora, y la constancia no debe perderse por la base ocupada.
 */
async function claim(userId: string, m: CustomerMessage, now: number) {
  const [row] = await writeTransaction((tx) =>
    tx
      .insert(customerEmail)
      .values({ key: m.key.slice(0, 160), userId, kind: m.kind, subject: m.subject.slice(0, 200), status: "enviando", attempts: 1, createdAt: now })
      .onConflictDoUpdate({
        target: customerEmail.key,
        set: { status: "enviando", attempts: sql`${customerEmail.attempts} + 1`, error: null },
        setWhere: and(eq(customerEmail.status, "fallido"), lt(customerEmail.attempts, MAX_ATTEMPTS)),
      })
      .returning({ key: customerEmail.key }),
  );
  return Boolean(row);
}

export type CustomerEmailResult = "enviado" | "fallido" | "omitido" | "repetido";

/**
 * Envía el aviso ya. `to` reemplaza al correo de la cuenta (solo para avisar que la cuenta se eliminó, cuando
 * su correo ya se borró). Nunca lanza errores.
 */
export async function deliverCustomerEmail(
  userId: string,
  m: CustomerMessage,
  { to, name, fetchImpl = fetch, now = Date.now() }: { to?: string; name?: string | null; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<CustomerEmailResult> {
  const cfg = customerEmailConfig();
  if (!cfg.enabled || !cfg.from) return "omitido";
  const recipient = to ? (EMAIL.test(to) && !isDeletedEmail(to) ? { email: to, name: name ?? null } : null) : await recipientOf(userId);
  if (!recipient) return "omitido";
  if (!(await claim(userId, m, now))) return "repetido";
  const support = await getSupport().catch(() => null);
  const { subject, text, html } = renderCustomerEmail(m, { name: recipient.name, support: support?.email ?? support?.whatsapp ?? null });
  let error: string | null = null;
  try {
    const res = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [recipient.email], subject, text, html, ...(support?.email && { reply_to: support.email }) }),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: unknown };
      error = `${res.status}: ${String(body.message ?? res.statusText).slice(0, 300)}`;
    }
  } catch (err) {
    error = String(err).slice(0, 200);
  }
  await writeTransaction((tx) =>
    tx
      .update(customerEmail)
      .set(error ? { status: "fallido", error } : { status: "enviado", sentAt: Date.now(), error: null })
      .where(eq(customerEmail.key, m.key.slice(0, 160))),
  );
  if (error && !process.env.VITEST) console.error(JSON.stringify({ tipo: "correo_cliente", accion: "no_enviado", aviso: m.kind, error }));
  return error ? "fallido" : "enviado";
}

const g = globalThis as unknown as { __xgeCustomerEmailTasks?: Set<Promise<unknown>> };

/**
 * Programa un aviso para después de responder. `build` arma el mensaje (puede consultar la base) fuera del
 * camino del usuario; si devuelve null, no se envía nada.
 */
export function emailCustomer(userId: string, build: () => CustomerMessage | null | Promise<CustomerMessage | null>, options: { to?: string; name?: string | null } = {}) {
  if (!customerEmailConfig().enabled) return;
  const task = async () => {
    try {
      const m = await build();
      if (m) await deliverCustomerEmail(userId, m, options);
    } catch (err) {
      if (!process.env.VITEST) console.error(JSON.stringify({ tipo: "correo_cliente", accion: "fallido", error: String(err).slice(0, 200) }));
    }
  };
  try {
    after(task);
  } catch {
    // Fuera de una petición (pruebas o scripts): se envía de una vez.
    const p = task();
    const tasks = (g.__xgeCustomerEmailTasks ??= new Set());
    tasks.add(p);
    void p.finally(() => tasks.delete(p));
  }
}

/** Para las pruebas: espera los avisos que se enviaron fuera de una petición. */
export async function flushCustomerEmails() {
  await Promise.all([...(g.__xgeCustomerEmailTasks ?? [])]);
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
}

interface WithdrawalLike {
  id: string;
  amountCop: number;
  status: string;
  note?: string | null;
  txHash?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  walletAddress?: string | null;
}

export interface PlanLike {
  id: string;
  planId: string;
  planName: string;
  months: number;
  paidMonths: number;
  paidUntil: number;
  monthlyCop: number;
  graceEndsAt: number | null;
}

const month = (p: { periodIndex: number | null }) => (p.periodIndex ? `el mes ${p.periodIndex} de tu plan` : "un mes de tu plan");
const PANEL = { label: "Abrir mi panel", path: "/panel" };
const MOVEMENTS = { label: "Ver mis movimientos", path: "/panel/billetera" };

export const customerMessages = {
  paymentConfirmed: (p: PaymentLike, period: { startsAt: number; endsAt: number } | null): CustomerMessage => ({
    key: `pago:${p.id}`,
    kind: "pago_confirmado",
    subject: `Confirmamos tu pago de ${formatCop(p.amountCop)}`,
    lines: [
      `Recibimos tu pago de ${formatCop(p.amountCop)} por ${month(p)}.`,
      period ? `Ese mes genera energía del ${formatDate(period.startsAt)} al ${formatDate(period.endsAt)}.` : "El mes ya está activo.",
      `El comprobante en PDF está en tus movimientos (orden ${p.id}).`,
    ],
    cta: MOVEMENTS,
  }),
  paymentToRefund: (p: PaymentLike): CustomerMessage => ({
    key: `por-devolver:${p.id}`,
    kind: "pago_por_devolver",
    subject: `Vamos a devolverte un pago de ${formatCop(p.amountCop)}`,
    lines: [
      `Recibimos un pago de ${formatCop(p.amountCop)}, pero no pudimos usarlo para activar ${month(p)}.${p.note ? ` ${p.note}` : ""}`,
      "Te devolvemos el dinero por el mismo medio cuando sea posible, y te escribimos cuando quede registrado. No tienes que hacer nada.",
    ],
    cta: MOVEMENTS,
  }),
  refunded: (p: PaymentLike, reference: string): CustomerMessage => ({
    key: `devuelto:${p.id}`,
    kind: "pago_devuelto",
    subject: `Registramos la devolución de tu pago de ${formatCop(p.amountCop)}`,
    lines: [
      `Devolvimos tu pago de ${formatCop(p.amountCop)} (orden ${p.id}). Referencia de la devolución: ${reference}.`,
      "Según tu banco o medio de pago, puede tardar unos días en verse en tu cuenta.",
    ],
    cta: MOVEMENTS,
  }),
  transferRejected: (p: PaymentLike, reason: string): CustomerMessage => ({
    key: `transferencia-no:${p.id}`,
    kind: "transferencia_no_confirmada",
    subject: "No pudimos confirmar tu transferencia",
    lines: [
      `Revisamos tu transferencia de ${formatCop(p.amountCop)} para ${month(p)} y no pudimos confirmarla: ${reason}.`,
      "Si ya transferiste, responde a este correo con el comprobante y lo revisamos de nuevo. Si no, puedes pagar ese mes desde tu panel.",
    ],
    cta: p.subscriptionId ? { label: "Pagar el mes", path: renewalCheckoutHref(p.subscriptionId) } : PANEL,
  }),
  withdrawalPaid: (w: WithdrawalLike): CustomerMessage => ({
    key: `retiro:${w.id}:pagado`,
    kind: "retiro_pagado",
    subject: `Pagamos tu retiro de ${formatCop(w.amountCop)}`,
    lines: [
      w.walletAddress
        ? `Enviamos ${formatCop(w.amountCop)} en USDT a tu wallet terminada en ${w.walletAddress.slice(-4)}.`
        : `Enviamos ${formatCop(w.amountCop)} a tu cuenta${w.bankName ? ` de ${w.bankName}` : ""}${w.bankAccountNumber ? ` terminada en ${w.bankAccountNumber.slice(-4)}` : ""}.`,
      w.txHash ? `Referencia del envío: ${w.txHash}.` : "Lo verás reflejado según los tiempos de tu banco.",
    ],
    cta: MOVEMENTS,
  }),
  withdrawalRejected: (w: WithdrawalLike): CustomerMessage => ({
    key: `retiro:${w.id}:rechazado`,
    kind: "retiro_rechazado",
    subject: `Tu retiro de ${formatCop(w.amountCop)} no se aprobó`,
    lines: [`Motivo: ${w.note ?? "no se pudo verificar la cuenta de destino"}.`, "El dinero volvió a tu saldo. Puedes pedir un retiro nuevo cuando quieras."],
    cta: MOVEMENTS,
  }),
  monthDue: (s: PlanLike): CustomerMessage => ({
    key: `mensualidad:${s.id}:${s.paidMonths + 1}`,
    kind: "mensualidad_por_vencer",
    subject: `Tu ${s.planName} necesita el pago del mes ${s.paidMonths + 1}`,
    lines: [
      `El mes ${s.paidMonths} de tu ${s.planName} termina el ${formatDate(s.paidUntil)}.`,
      `Paga el mes ${s.paidMonths + 1} (${formatCop(s.monthlyCop)}) antes de esa fecha para que tu plan siga generando energía sin pausa.`,
    ],
    cta: { label: `Pagar el mes ${s.paidMonths + 1}`, path: renewalCheckoutHref(s.id) },
  }),
  planPaused: (s: PlanLike): CustomerMessage => ({
    key: `pausa:${s.id}:${s.paidMonths + 1}`,
    kind: "plan_en_pausa",
    subject: `Tu ${s.planName} está en pausa`,
    lines: [
      `Tu ${s.planName} dejó de generar energía el ${formatDate(s.paidUntil)} porque falta el pago del mes ${s.paidMonths + 1} (${formatCop(s.monthlyCop)}).`,
      `Puedes retomarlo hasta el ${formatDate(s.graceEndsAt ?? s.paidUntil)}. Después se cierra y libera su cupo; la energía que ya generó sigue en tu saldo.`,
    ],
    cta: { label: `Pagar el mes ${s.paidMonths + 1}`, path: renewalCheckoutHref(s.id) },
  }),
  planEnding: (s: PlanLike): CustomerMessage => ({
    key: `termina:${s.id}`,
    kind: "plan_por_terminar",
    subject: `Tu ${s.planName} termina el ${formatDate(s.paidUntil)}`,
    lines: [
      `Tu ${s.planName} completa sus ${s.months} meses el ${formatDate(s.paidUntil)}.`,
      "Si quieres seguir generando energía, puedes comprarlo de nuevo con los precios vigentes. El plan nuevo empieza cuando se confirme su primer pago.",
    ],
    cta: { label: "Renovar mi plan", path: planCheckoutHref(s.planId) },
  }),
  dataRequestAnswered: (requestId: string, resolution: string): CustomerMessage => ({
    key: `datos:${requestId}`,
    kind: "solicitud_respondida",
    subject: "Respondimos tu solicitud sobre tus datos",
    lines: ["Revisamos tu solicitud de eliminar tu cuenta y tus datos personales.", resolution],
    cta: { label: "Ver mi perfil", path: "/panel/perfil" },
  }),
  accountDeleted: (requestId: string, keepsAccounting: boolean): CustomerMessage => ({
    key: `datos:${requestId}`,
    kind: "cuenta_eliminada",
    subject: `Eliminamos tu cuenta de ${BRAND.name}`,
    lines: [
      "Atendimos tu solicitud: eliminamos tu cuenta, tu acceso y tus datos de contacto.",
      keepsAccounting
        ? "Conservamos tu nombre, tu documento y tus movimientos durante el tiempo que exigen las normas contables y tributarias."
        : "También borramos tus datos personales.",
      "Este es el último correo que te enviamos.",
    ],
  }),
};

/* ───────────── Cuándo se envían ───────────── */

/** Se confirmó un pago real (el pago de prueba no avisa). Dice qué días genera ese mes. */
export function emailPaymentConfirmed(p: PaymentLike) {
  if (p.method === "demo") return;
  emailCustomer(p.userId, async () => {
    const [period] = await db.select({ startsAt: planPeriod.startsAt, endsAt: planPeriod.endsAt }).from(planPeriod).where(eq(planPeriod.txId, p.id));
    return customerMessages.paymentConfirmed(p, period ?? null);
  });
}

export function emailPaymentToRefund(p: PaymentLike) {
  if (p.method === "demo") return;
  emailCustomer(p.userId, () => customerMessages.paymentToRefund(p));
}

export function emailRefunded(p: PaymentLike, reference: string) {
  emailCustomer(p.userId, () => customerMessages.refunded(p, reference));
}

export function emailTransferRejected(p: PaymentLike, reason: string) {
  emailCustomer(p.userId, () => customerMessages.transferRejected(p, reason));
}

export function emailWithdrawalDecided(userId: string, w: WithdrawalLike) {
  if (w.status === "confirmada") emailCustomer(userId, () => customerMessages.withdrawalPaid(w));
  else if (w.status === "rechazada") emailCustomer(userId, () => customerMessages.withdrawalRejected(w));
}
