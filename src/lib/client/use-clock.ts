"use client";
import { useEffect, useState } from "react";

/** Actual wall clock. Financial workspace time is independent of presentation mode. */
export function useClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
