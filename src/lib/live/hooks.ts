"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe, currentTime } from "./store";

export function useLive() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Reloj que respeta el Modo presentación; se actualiza cada `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const live = useLive();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(currentTime(live.presentation));
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, live.presentation]);
  return now;
}

/** true cuando el usuario pidió menos movimiento. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
