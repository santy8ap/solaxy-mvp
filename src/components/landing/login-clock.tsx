"use client";
import { useCatalog } from "@/lib/client/use-catalog";
import { useNow } from "@/lib/client/use-now";
import { SolarClock } from "@/components/solar/solar-clock";

/** El reloj solar, en pequeño, junto al formulario de ingreso. */
export function LoginClock() {
  const { catalog } = useCatalog();
  const now = useNow(1000);
  return <SolarClock solar={catalog.solar} now={now} size="panel" />;
}
