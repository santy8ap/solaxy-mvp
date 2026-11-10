/**
 * Planes de energía. Cada plan es un contrato de 3 meses que se paga mes a mes.
 * Los precios son los valores iniciales: el admin puede cambiarlos y cada plan comprado guarda los suyos.
 */
export interface PlanSpec {
  id: string;
  name: string;
  /** Energía total del contrato (kWh) */
  totalKwh: number;
  /** Lo que paga la empresa por cada kWh (COP) */
  priceCopPerKwh: number;
}

/** Duración del contrato, en meses de 30 días. */
export const PLAN_MONTHS = 3;

/** Precio al que se vende toda la energía (COP por kWh). */
export const SALE_COP_PER_KWH = 400;

export const PLANS: readonly PlanSpec[] = [
  { id: "p720", name: "Plan 720", totalKwh: 720_000, priceCopPerKwh: 320 },
  { id: "p540", name: "Plan 540", totalKwh: 540_000, priceCopPerKwh: 330 },
  { id: "p360", name: "Plan 360", totalKwh: 360_000, priceCopPerKwh: 340 },
  { id: "p180", name: "Plan 180", totalKwh: 180_000, priceCopPerKwh: 348 },
];

export type PlanId = (typeof PLANS)[number]["id"];
