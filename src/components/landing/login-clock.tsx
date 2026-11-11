"use client";
import { useCatalog, usePlantNow } from "@/lib/client/use-catalog";
import { SolarClock } from "@/components/solar/solar-clock";

/** El reloj solar, en pequeño, junto al formulario de ingreso. */
export function LoginClock() {
  const { catalog } = useCatalog();
  const now = usePlantNow(1000);
  return <SolarClock solar={catalog.solar} now={now} size="panel" />;
}
