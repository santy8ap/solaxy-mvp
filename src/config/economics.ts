/** Parámetros económicos del modelo de negocio (COP). */
export const ECONOMICS = {
  /** Precio de 1 kW de la planta */
  pricePerKwCop: 4_800_000,
  minPurchaseKw: 0.1,
  maxPurchaseKw: 50,
  /** Tarifa de venta de la energía en el día */
  tariffDayCopPerKwh: 560,
  /** Tarifa en hora pico (descarga de batería) */
  tariffPeakCopPerKwh: 820,
  /** Horas locales [inicio, fin) de la hora pico */
  peakWindow: [18, 22] as const,
  /** Fracción del ingreso que llega al inversionista (18 % O&M + plataforma) */
  netFactor: 0.82,
  /** Venta inmediata a la plataforma: % del precio actual */
  instantSellFactor: 0.97,
  /** Factor de emisión de la red colombiana (kg CO₂ por kWh) */
  co2KgPerKwh: 0.126,
  /** Consumo promedio de un hogar colombiano (kWh/mes) */
  homeKwhPerMonth: 160,
  /** CO₂ que absorbe un árbol al año (kg) */
  treeCo2KgPerYear: 22,
} as const;

export const PACKAGES = [
  { id: "semilla", name: "Semilla", kw: 0.5, blurb: "Tu primer paso en energía solar" },
  { id: "sol", name: "Sol", kw: 2, blurb: "El favorito de la comunidad" },
  { id: "estrella", name: "Estrella", kw: 10, blurb: "Para inversionistas serios" },
] as const;
