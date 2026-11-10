import { z } from "zod";

/** Qué se paga: el primer mes de un plan nuevo (`planId`) o el mes siguiente de un plan del usuario (`subscriptionId`). */
export const planTarget = {
  planId: z.string().min(1).max(20).optional(),
  subscriptionId: z.string().regex(/^PLN-[0-9A-F]{8}$/, "Plan inválido").optional(),
};

export const onePlanTarget = (b: { planId?: string; subscriptionId?: string }) => (b.planId != null) !== (b.subscriptionId != null);
export const PLAN_TARGET_ERROR = "Indica el plan que quieres comprar o el plan que vas a pagar";
