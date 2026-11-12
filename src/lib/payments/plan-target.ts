import { z } from "zod";
import { MarketError } from "@/lib/errors";

/** Qué se paga: el primer mes de un plan nuevo (`planId`) o el mes siguiente de un plan del usuario (`subscriptionId`). */
export const planTarget = {
  planId: z.string().min(1).max(20).optional(),
  subscriptionId: z
    .string()
    .regex(/^PLN-[0-9A-F]{8}$/, "Plan inválido")
    .optional(),
  expectedAmountCop: z.number().int().positive().optional(),
  expectedSaleCopPerKwh: z.number().int().positive().optional(),
};

export interface ExpectedPayment {
  expectedAmountCop?: number;
  expectedSaleCopPerKwh?: number;
}

/** El servidor decide el importe y exige volver a revisar si cambió lo mostrado en el resumen. */
export function assertExpectedPayment(
  actual: { amountCop: number; saleCopPerKwh: number },
  expected: ExpectedPayment,
) {
  if (
    (expected.expectedAmountCop != null &&
      actual.amountCop !== expected.expectedAmountCop) ||
    (expected.expectedSaleCopPerKwh != null &&
      actual.saleCopPerKwh !== expected.expectedSaleCopPerKwh)
  ) {
    throw new MarketError(
      "Los precios del plan se actualizaron. Actualiza el resumen y confirma los nuevos valores antes de pagar.",
      409,
      { code: "precio_actualizado" },
    );
  }
}

export const onePlanTarget = (b: {
  planId?: string;
  subscriptionId?: string;
}) => (b.planId != null) !== (b.subscriptionId != null);
export const PLAN_TARGET_ERROR =
  "Indica el plan que quieres comprar o el plan que vas a pagar";
