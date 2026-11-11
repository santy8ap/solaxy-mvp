/** Public catalog. Contract activation and billing require server-side validation. */
export const ENERGY_PLAN_TERM_MONTHS = 3;
export const ENERGY_PLAN_DAYS_PER_MONTH = 30;
export const ENERGY_REFERENCE_SALE_COP = 400;
export const ENERGY_PLANS = [
  { id: "01", name: "Horizonte", daily: 2_000, price: 348 },
  { id: "02", name: "Órbita", daily: 4_000, price: 340 },
  { id: "03", name: "Cénit", daily: 6_000, price: 330 },
  { id: "04", name: "Eclipse", daily: 8_000, price: 320 },
] as const;
export type EnergyPlan = (typeof ENERGY_PLANS)[number];

export function planSummary(plan: EnergyPlan) {
  const monthlyKwh = plan.daily * ENERGY_PLAN_DAYS_PER_MONTH;
  return {
    monthlyKwh,
    totalKwh: monthlyKwh * ENERGY_PLAN_TERM_MONTHS,
    monthlyCop: monthlyKwh * plan.price,
    dailyGrossProfitCop: plan.daily * (ENERGY_REFERENCE_SALE_COP - plan.price),
    grossMarginPct:
      ((ENERGY_REFERENCE_SALE_COP - plan.price) / plan.price) * 100,
  };
}
