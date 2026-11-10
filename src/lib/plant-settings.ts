import { PLANS, PLAN_MONTHS, SALE_COP_PER_KWH, type PlanSpec } from "@/config/plans";
import { PLANT } from "@/config/plant";
import { SOLAR, type SolarDay } from "@/config/solar";
import { planEconomics, type PlanEconomics } from "@/lib/energy/plan-math";
import { plantDailyKwh } from "@/lib/energy/solar-day";

/** Lo que el administrador puede cambiar de la planta y de los planes. Isomórfico. */
export interface PlantSettings {
  name: string;
  location: string;
  /** Potencia máxima de la curva solar (kW) */
  peakKw: number;
  /** Precio al que se vende toda la energía (COP por kWh) */
  saleCopPerKwh: number;
  /** Precio por kWh de cada plan, por id */
  planPrices: Record<string, number>;
  updatedAt: number | null;
}

export const DEFAULT_SETTINGS: PlantSettings = {
  name: PLANT.name,
  location: PLANT.location,
  peakKw: SOLAR.peakKw,
  saleCopPerKwh: SALE_COP_PER_KWH,
  planPrices: Object.fromEntries(PLANS.map((p) => [p.id, p.priceCopPerKwh])),
  updatedAt: null,
};

/** Lee el JSON de precios guardado; lo que falte o esté mal usa el valor inicial del plan. */
export function parsePlanPrices(raw: string | null | undefined): Record<string, number> {
  let saved: Record<string, unknown> = {};
  try {
    const json = JSON.parse(raw || "{}");
    if (json && typeof json === "object") saved = json as Record<string, unknown>;
  } catch {
    /* JSON dañado: se usan los valores iniciales */
  }
  return Object.fromEntries(
    PLANS.map((p) => {
      const v = Number(saved[p.id]);
      return [p.id, Number.isFinite(v) && v > 0 ? Math.round(v) : p.priceCopPerKwh];
    }),
  );
}

export function solarFrom(s: Pick<PlantSettings, "peakKw">): SolarDay {
  return { ...SOLAR, peakKw: s.peakKw };
}

/** Un plan del catálogo con sus precios vigentes y su economía. */
export interface CatalogPlan extends PlanSpec, PlanEconomics {
  saleCopPerKwh: number;
}

export function catalogFrom(s: Pick<PlantSettings, "saleCopPerKwh" | "planPrices">): CatalogPlan[] {
  return PLANS.map((p) => {
    const plan = { ...p, priceCopPerKwh: s.planPrices[p.id] ?? p.priceCopPerKwh };
    return { ...plan, saleCopPerKwh: s.saleCopPerKwh, ...planEconomics(plan, s.saleCopPerKwh, PLAN_MONTHS) };
  });
}

/** Devuelve el primer problema encontrado, o null si todo está bien. */
export function validateSettings(s: PlantSettings, ctx: { contractedDailyKwh: number }): string | null {
  if (!s.name || s.name.trim().length < 2 || s.name.length > 60) return "El nombre de la planta debe tener entre 2 y 60 caracteres.";
  if (!s.location || s.location.trim().length < 2 || s.location.length > 80) return "La ubicación debe tener entre 2 y 80 caracteres.";
  if (!Number.isFinite(s.peakKw) || s.peakKw < 100 || s.peakKw > 500_000) return "La potencia máxima debe estar entre 100 y 500.000 kW.";
  const daily = plantDailyKwh(solarFrom(s));
  if (daily + 1e-6 < ctx.contractedDailyKwh) {
    return `Con esa potencia la planta entrega ${Math.floor(daily).toLocaleString("es-CO")} kWh al día, menos que los ${Math.round(ctx.contractedDailyKwh).toLocaleString("es-CO")} kWh diarios ya contratados.`;
  }
  if (!Number.isInteger(s.saleCopPerKwh) || s.saleCopPerKwh < 50 || s.saleCopPerKwh > 5000) return "El precio de venta debe estar entre $ 50 y $ 5.000 por kWh, sin decimales.";
  for (const p of PLANS) {
    const price = s.planPrices[p.id];
    if (!Number.isInteger(price) || price < 1) return `El precio por kWh del ${p.name} debe ser un número entero mayor que cero.`;
    if (price >= s.saleCopPerKwh) return `El precio del ${p.name} ($ ${price}) debe ser menor que el precio de venta ($ ${s.saleCopPerKwh}): si no, el plan no deja utilidad.`;
  }
  return null;
}
