/**
 * Reloj solar de la planta: la campana de generación que definió el cliente.
 * De 6:00 a 19:00 (hora de Colombia) con un máximo de 8.000 kW. El admin puede cambiar la potencia máxima.
 */
export interface SolarDay {
  /** Hora local en que empieza la generación */
  startHour: number;
  /** Hora local en que termina */
  endHour: number;
  /** Potencia máxima de la planta (kW), a la mitad del día solar */
  peakKw: number;
}

export const SOLAR: SolarDay = { startHour: 6, endHour: 19, peakKw: 8000 };
