"use client";
import { useEffect } from "react";
import { useSettings } from "@/lib/client/use-settings";
import { setLiveConfig } from "@/lib/live/store";

/** Mantiene el motor en vivo del navegador con la configuración actual de la planta. */
export function LiveConfigSync() {
  const { spec, econ, loaded } = useSettings();
  useEffect(() => {
    if (loaded) setLiveConfig(spec, econ);
  }, [spec, econ, loaded]);
  return null;
}
