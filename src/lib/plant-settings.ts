import { ECONOMICS, type Economics } from "@/config/economics";
import { PLANT, type PlantSpec } from "@/config/plant";

/** Lo que el administrador puede cambiar de la planta y del negocio. */
export interface PlantSettings {
  name: string;
  location: string;
  capacityKwp: number;
  pricePerKwCop: number;
  tariffDayCop: number;
  tariffPeakCop: number;
  /** % del ingreso para operación y plataforma */
  commissionPct: number;
  withdrawalApproval: boolean;
  updatedAt: number | null;
}

export const DEFAULT_SETTINGS: PlantSettings = {
  name: PLANT.name,
  location: PLANT.location,
  capacityKwp: PLANT.capacityKwp,
  pricePerKwCop: ECONOMICS.pricePerKwCop,
  tariffDayCop: ECONOMICS.tariffDayCopPerKwh,
  tariffPeakCop: ECONOMICS.tariffPeakCopPerKwh,
  commissionPct: Math.round((1 - ECONOMICS.netFactor) * 1000) / 10,
  withdrawalApproval: true,
  updatedAt: null,
};

/** Especificación física de la planta según la configuración (la capacidad escala equipos). */
export function specFrom(s: PlantSettings): PlantSpec {
  const k = s.capacityKwp / PLANT.capacityKwp;
  return {
    ...PLANT,
    name: s.name,
    location: s.location,
    capacityKwp: s.capacityKwp,
    acCapacityKw: Math.round(PLANT.acCapacityKw * k),
    moduleCount: Math.round(PLANT.moduleCount * k),
    inverterCount: Math.max(1, Math.round(PLANT.inverterCount * k)),
  };
}

export function econFrom(s: PlantSettings): Economics {
  return {
    ...ECONOMICS,
    pricePerKwCop: s.pricePerKwCop,
    tariffDayCopPerKwh: s.tariffDayCop,
    tariffPeakCopPerKwh: s.tariffPeakCop,
    netFactor: 1 - s.commissionPct / 100,
  };
}

/** Devuelve el primer problema encontrado, o null si todo está bien. */
export function validateSettings(s: PlantSettings, ctx: { soldKw: number }): string | null {
  if (!s.name || s.name.trim().length < 2 || s.name.length > 60) return "El nombre de la planta debe tener entre 2 y 60 caracteres.";
  if (!s.location || s.location.trim().length < 2 || s.location.length > 80) return "La ubicación debe tener entre 2 y 80 caracteres.";
  if (!Number.isFinite(s.capacityKwp) || s.capacityKwp < 100 || s.capacityKwp > 50_000) return "La capacidad debe estar entre 100 y 50.000 kWp.";
  if (s.capacityKwp < ctx.soldKw) return `La capacidad no puede ser menor que los ${ctx.soldKw.toLocaleString("es-CO")} kW ya vendidos.`;
  if (!Number.isFinite(s.pricePerKwCop) || s.pricePerKwCop < 500_000 || s.pricePerKwCop > 50_000_000) return "El precio por kW debe estar entre $ 500.000 y $ 50.000.000.";
  for (const [label, v] of [
    ["de día", s.tariffDayCop],
    ["pico", s.tariffPeakCop],
  ] as const) {
    if (!Number.isFinite(v) || v < 50 || v > 5000) return `La tarifa ${label} debe estar entre $ 50 y $ 5.000 por kWh.`;
  }
  if (!Number.isFinite(s.commissionPct) || s.commissionPct < 0 || s.commissionPct > 60) return "La comisión debe estar entre 0 % y 60 %.";
  return null;
}
