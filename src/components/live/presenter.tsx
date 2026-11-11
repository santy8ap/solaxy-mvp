"use client";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";
import { useLive, useNow } from "@/lib/live/hooks";
import { setPresentation } from "@/lib/live/store";
import { HOUR_MS, dayStartMs, localDayIndex } from "@/lib/sim";

const SPEEDS = [1, 60, 600] as const;

function todayAt(hour: number) {
  return dayStartMs(localDayIndex(Date.now())) + hour * HOUR_MS;
}

/**
 * Control del Modo presentación. Se abre con la tecla P (fuera de campos de
 * texto) o con el evento "solaxy:presenter". Cuando está activo se ve siempre
 * el aviso "Simulación" para que nadie lo confunda con la hora real.
 */
export function PresenterControl() {
  const live = useLive();
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const p = live.presentation;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "p" || e.key === "P") setOpen((o) => !o);
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("solaxy:presenter", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("solaxy:presenter", onOpen);
    };
  }, []);

  if (!open && !p.active) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-5 md:right-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-dusk-400/60 bg-silicon-950/90 px-4 py-2.5 text-sm text-dusk-300 shadow-xl backdrop-blur"
        >
          <span className="live-dot" data-tone="sim" />
          Simulación: {now ? formatTime(now) : ""}, ×{p.speed}
        </button>
      ) : (
        <div className="w-[300px] rounded-none border border-dusk-400/50 bg-silicon-950/95 p-4 text-sm shadow-2xl backdrop-blur" role="dialog" aria-label="Modo presentación">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-silver-50">Modo presentación</span>
            <button type="button" onClick={() => setOpen(false)} className="text-silver-400 hover:text-silver-50" aria-label="Cerrar">
              ✕
            </button>
          </div>
          <p className="mt-1 text-silver-400">Muestra la planta a otra hora. No guarda nada.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => setPresentation({ active: false })} aria-pressed={!p.active}>
              Hora real
            </button>
            <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => setPresentation({ active: true, at: todayAt(11.5) })}>
              Mediodía
            </button>
            <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => setPresentation({ active: true, at: todayAt(6) })}>
              Amanecer
            </button>
            <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => setPresentation({ active: true, at: todayAt(19) })}>
              7 p. m.
            </button>
          </div>
          <div className="mt-4 text-silver-400">Velocidad</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={p.active && p.speed === s}
                className={`btn !py-2 text-sm ${p.active && p.speed === s ? "btn-sun" : "btn-ghost"}`}
                onClick={() => setPresentation({ active: true, speed: s })}
              >
                ×{s}
              </button>
            ))}
          </div>
          {p.active && <p className="mt-3 text-dusk-300">Simulación activa: {now ? formatTime(now) : ""}</p>}
        </div>
      )}
    </div>
  );
}
