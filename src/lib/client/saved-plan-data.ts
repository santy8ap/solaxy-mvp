import { ENERGY_PLANS, type EnergyPlan } from "@/config/energy-plans";
export interface SavedPlan {
  planId: EnergyPlan["id"];
  savedAt: number;
}
const ids = new Set<string>(ENERGY_PLANS.map((plan) => plan.id));
/** Only plan identifiers and dates are stored. Company details are never persisted here. */
export function parseSavedPlans(raw: string | null): readonly SavedPlan[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const unique = new Map<string, SavedPlan>();
    for (const value of data.slice(0, 100)) {
      if (!value || typeof value !== "object") continue;
      const { planId, savedAt } = value;
      if (
        typeof planId !== "string" ||
        !ids.has(planId) ||
        typeof savedAt !== "number" ||
        !Number.isFinite(savedAt) ||
        savedAt < 0 ||
        savedAt > 8.64e15
      )
        continue;
      const previous = unique.get(planId);
      if (!previous || previous.savedAt < savedAt)
        unique.set(planId, { planId: planId as EnergyPlan["id"], savedAt });
    }
    return [...unique.values()].sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}
