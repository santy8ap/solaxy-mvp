"use client";
import type { SolarDay } from "@/config/solar";
import { plantDailyKwh } from "@/lib/energy/solar-day";
import {
  DEFAULT_SETTINGS,
  catalogFrom,
  solarFrom,
  type CatalogPlan,
} from "@/lib/plant-settings";
import { useJson } from "./use-json";
import { useNow } from "./use-now";

/** Lo que devuelve /api/plans. */
export interface CatalogDTO {
  /** Hora del servidor al responder (falta en los valores iniciales) */
  asOf?: number;
  plantName: string;
  location: string;
  solar: SolarDay;
  saleCopPerKwh: number;
  plantDailyKwh: number;
  contractedDailyKwh: number;
  availableDailyKwh: number;
  plans: (CatalogPlan & { available: boolean })[];
}

const DEFAULT_SOLAR = solarFrom(DEFAULT_SETTINGS);

/** Lo que se muestra mientras llega el catálogo del servidor: los valores iniciales, que casi siempre son los vigentes. */
export const DEFAULT_CATALOG: CatalogDTO = {
  plantName: DEFAULT_SETTINGS.name,
  location: DEFAULT_SETTINGS.location,
  solar: DEFAULT_SOLAR,
  saleCopPerKwh: DEFAULT_SETTINGS.saleCopPerKwh,
  plantDailyKwh: plantDailyKwh(DEFAULT_SOLAR),
  contractedDailyKwh: 0,
  availableDailyKwh: plantDailyKwh(DEFAULT_SOLAR),
  plans: catalogFrom(DEFAULT_SETTINGS).map((p) => ({ ...p, available: true })),
};

/** Catálogo vigente (precios que puede cambiar el admin y cupo de la planta). */
export function useCatalog() {
  const { data, error, receivedAt, reload } = useJson<CatalogDTO>(
    "/api/plans",
    { refreshMs: 5 * 60_000 },
  );
  // Diferencia entre el reloj del servidor y el de este dispositivo.
  const clockOffset = data?.asOf && receivedAt ? data.asOf - receivedAt : 0;
  return {
    catalog: data ?? DEFAULT_CATALOG,
    loaded: !!data,
    error,
    reload,
    clockOffset,
  };
}

/**
 * La hora de la planta: la del servidor, no la del dispositivo. Así el reloj solar marca lo mismo
 * para todos, aunque el computador o el celular tengan la hora mal puesta.
 */
export function usePlantNow(everyMs = 1000) {
  const { clockOffset } = useCatalog();
  return useNow(everyMs, clockOffset);
}
