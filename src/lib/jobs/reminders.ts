import "server-only";
import { customerEmailConfig, customerMessages, deliverCustomerEmail, type CustomerMessage, type PlanLike } from "@/lib/customer-email";
import type { SubscriptionState } from "@/lib/energy/plan-math";
import { listAllSubscriptions } from "@/lib/plans/service";
import { toSubscriptionDTO } from "@/lib/portfolio";
import { readConfig } from "@/lib/settings";
import { DAY_MS } from "@/lib/time";

/** Con cuántos días de anticipación se avisa que vence una mensualidad, y que termina un plan. */
export const MONTH_DUE_DAYS = 5;
export const PLAN_ENDING_DAYS = 7;
const BUDGET_MS = 20_000;

/**
 * El recordatorio que le toca a un plan en este momento, si alguno: las mismas reglas de los avisos del panel.
 * Cada recordatorio tiene su clave (plan y mes), así que se envía una sola vez aunque esto corra cada hora.
 */
export function reminderFor(sub: PlanLike & { state: SubscriptionState }, now: number, renewed: boolean): CustomerMessage | null {
  const pending = sub.paidMonths < sub.months;
  if (sub.state === "en_pausa" && pending && now >= sub.paidUntil) return customerMessages.planPaused(sub);
  if (sub.state === "activa" && pending && sub.paidUntil - now <= MONTH_DUE_DAYS * DAY_MS) return customerMessages.monthDue(sub);
  if (sub.state === "activa" && !pending && !renewed && sub.paidUntil - now <= PLAN_ENDING_DAYS * DAY_MS) return customerMessages.planEnding(sub);
  return null;
}

/** Envía por correo los recordatorios de mensualidades, planes en pausa y planes que terminan. */
export async function sendPlanReminders({ now = Date.now(), clock = Date.now }: { now?: number; clock?: () => number } = {}) {
  const result = { enviados: 0, omitidos: 0, fallidos: 0 };
  if (!customerEmailConfig().enabled) return result;
  const started = clock();
  const { solar } = await readConfig();
  const subs = (await listAllSubscriptions()).map((s) => ({ userId: s.userId, dto: toSubscriptionDTO(s, solar, now) }));
  for (const { userId, dto } of subs) {
    if (clock() - started >= BUDGET_MS) break;
    const renewed = subs.some((o) => o.userId === userId && o.dto.id !== dto.id && o.dto.planId === dto.planId && (o.dto.startedAt ?? 0) > (dto.startedAt ?? 0));
    const message = reminderFor(dto, now, renewed);
    if (!message) continue;
    const r = await deliverCustomerEmail(userId, message, { now });
    if (r === "enviado") result.enviados++;
    else if (r === "fallido") result.fallidos++;
    else result.omitidos++;
  }
  return result;
}
