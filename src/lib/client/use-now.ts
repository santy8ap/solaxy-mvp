"use client";
import { useEffect, useState } from "react";

/**
 * La hora actual, refrescada cada `everyMs`. Devuelve null en el servidor y en el primer render
 * (así el HTML del servidor y el del navegador coinciden). `offsetMs` corrige el reloj del
 * dispositivo con el del servidor: los contadores de energía no dependen de la hora del computador.
 * Se detiene mientras la pestaña está oculta.
 */
export function useNow(everyMs = 1000, offsetMs = 0): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now() + offsetMs);
    const start = () => {
      tick();
      timer = setInterval(tick, everyMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [everyMs, offsetMs]);
  return now;
}
