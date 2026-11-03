"use client";
import { useMemo } from "react";
import { DEFAULT_SETTINGS, econFrom, specFrom, type PlantSettings } from "@/lib/plant-settings";
import { useJson } from "./use-json";

/** Configuración vigente de la planta (la cambia el administrador). */
export function useSettings() {
  const { data, reload } = useJson<PlantSettings>("/api/settings", { refreshMs: 60_000 });
  return useMemo(() => {
    const settings = data ?? DEFAULT_SETTINGS;
    return { settings, spec: specFrom(settings), econ: econFrom(settings), loaded: !!data, reload };
  }, [data, reload]);
}
