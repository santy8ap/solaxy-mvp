import "server-only";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { orderCode } from "@/lib/ids";
import { fulfillOrder } from "@/lib/orders";
import { resolvePlanPayment } from "@/lib/plans/service";
import { toTxDTO } from "@/lib/portfolio";
import { requireCompleteProfile } from "@/lib/profile";
import { payLog } from "./log";
import { assertExpectedPayment, type ExpectedPayment } from "./plan-target";

/**
 * Pago de prueba: confirma el mes al instante, sin mover dinero. Solo existe en modo de pruebas
 * (DEMO_MODE distinto de false): sirve para desarrollar y para mostrar el recorrido completo.
 */
export async function payWithTestPayment(
  input: {
    userId: string;
    planId?: string;
    subscriptionId?: string;
  } & ExpectedPayment,
) {
  if (!isDemoMode())
    throw new MarketError(
      "El pago de prueba solo existe en modo de pruebas. Paga con tarjeta, PSE, Nequi o cripto.",
      403,
    );
  await requireCompleteProfile(input.userId);
  const now = Date.now();
  const p = await resolvePlanPayment(
    input.userId,
    { planId: input.planId, subscriptionId: input.subscriptionId },
    now,
  );
  assertExpectedPayment(p, input);
  const orderId = orderCode();
  await db.insert(ledgerTx).values({
    id: orderId,
    userId: input.userId,
    kind: "plan_mes",
    status: "pendiente",
    amountCop: p.amountCop,
    asset: "COP",
    walletName: "Pago de prueba",
    createdAt: now,
    method: "demo",
    subscriptionId: p.subscriptionId,
    periodIndex: p.periodIndex,
    kwh: p.kwh,
  });
  const r = await fulfillOrder(orderId, { providerStatus: "prueba" }, { now });
  if (r.outcome !== "confirmada")
    throw new MarketError(r.order.note ?? "No se pudo activar el plan.", 409);
  payLog("pago_de_prueba", {
    orderId,
    userId: input.userId,
    plan: p.subscriptionId,
    mes: p.periodIndex,
  });
  return {
    order: toTxDTO(r.order),
    planName: p.planName,
    periodIndex: p.periodIndex,
  };
}
