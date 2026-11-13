"use client";
import type { AppConfigDTO } from "@/lib/app-config";
import { useJson } from "./use-json";

/**
 * Configuración pública del servidor. Mientras carga se asume lo más restrictivo:
 * sin modo demo y sin medios de pago, para no mostrar opciones que luego desaparecen.
 */
export function useAppConfig() {
  const { data, error, reload } = useJson<AppConfigDTO>("/api/config", { refreshMs: 5 * 60_000 });
  return { config: data ?? null, loaded: !!data, error, reload };
}
