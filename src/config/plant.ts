/**
 * Planta solar de demostración. Todos los valores son configurables.
 * El motor de simulación (src/lib/sim) usa esta especificación tanto en el
 * servidor como en el navegador, así que aquí no debe ir nada secreto.
 */
export interface BatterySpec {
  capacityKwh: number;
  powerKw: number;
  /** Fracción 0..1 */
  minSoc: number;
  /** Fracción 0..1 */
  maxSoc: number;
  chargeEff: number;
  dischargeEff: number;
  /** Horas locales [inicio, fin) */
  chargeWindow: readonly [number, number];
  dischargeWindow: readonly [number, number];
  /** Fracción máxima de la producción solar que se desvía a la batería */
  chargeFraction: number;
}

export interface PlantSpec {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  capacityKwp: number;
  acCapacityKw: number;
  moduleCount: number;
  moduleWatt: number;
  inverterCount: number;
  performanceRatio: number;
  /** Pérdida de potencia por °C sobre 25 °C (negativo) */
  tempCoeffPerC: number;
  battery: BatterySpec;
  climate: { tMinC: number; tMaxC: number };
  /** Semilla del clima simulado (determinista) */
  seed: number;
  /** Días de historia que se siembran desde la puesta en marcha */
  commissionedDaysAgo: number;
}

export const PLANT: PlantSpec = {
  id: "solaxy-solar-1",
  name: "Solaxy Solar I",
  location: "Santa Fe de Antioquia, Antioquia",
  lat: 6.5567,
  lng: -75.8281,
  capacityKwp: 2000,
  acCapacityKw: 1700,
  moduleCount: 3640,
  moduleWatt: 550,
  inverterCount: 10,
  performanceRatio: 0.8,
  tempCoeffPerC: -0.0037,
  battery: {
    capacityKwh: 2000,
    powerKw: 500,
    minSoc: 0.1,
    maxSoc: 0.95,
    chargeEff: 0.95,
    dischargeEff: 0.95,
    chargeWindow: [9.5, 15],
    dischargeWindow: [18, 22],
    chargeFraction: 0.35,
  },
  climate: { tMinC: 21, tMaxC: 31 },
  seed: 20261104,
  commissionedDaysAgo: 120,
};
