"use client";
import { useSettings } from "@/lib/client/use-settings";
import { useLive, useNow } from "@/lib/live/hooks";
import { Odometer } from "@/components/ui/odometer";
import { plantStatus } from "@/components/landing/hero";

/** Lectura compacta de la planta en vivo. */
export function LiveMini() {
  const { spec } = useSettings();
  const live = useLive();
  const now = useNow(1000);
  const r = live.payload?.reading;
  const status = r && now ? plantStatus(r, now) : null;
  return (
    <div className="panel-quiet p-5">
      <div className="flex items-center gap-2 text-sm text-silver-400">
        <span className="live-dot" data-tone={live.status === "simulated" ? "sim" : live.status === "live" ? undefined : "off"} />
        {spec.name}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <Odometer value={r?.deliveredKw ?? 0} className={`display text-4xl ${status?.tone === "dusk" ? "text-dusk-300" : "text-sun-300"}`} />
        <span className="text-lg text-silver-300">kW</span>
      </div>
      <p className="mt-1 text-sm text-silver-300">{status?.label ?? "conectando…"}</p>
    </div>
  );
}
