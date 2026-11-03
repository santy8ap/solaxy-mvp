"use client";
import { useEffect, useRef, useState } from "react";
import type { PortfolioDTO } from "@/lib/portfolio";
import { useLive } from "@/lib/live/hooks";

export interface LiveEarnings {
  earned: number;
  today: number;
  ratePerHour: number;
  /** kW que te corresponden de la potencia entregada ahora */
  myKw: number;
  simulated: boolean;
}

/**
 * Ganancias en vivo: parte del valor del servidor y suma, cuadro a cuadro, la
 * potencia entregada × tu participación × la tarifa del momento. Cada vez que
 * llega un portafolio nuevo se ajusta suavemente al valor real (sin saltos).
 * En Modo presentación acelera la suma, solo en pantalla.
 */
export function useLiveEarnings(p: PortfolioDTO | undefined): LiveEarnings | null {
  const live = useLive();
  const [view, setView] = useState<LiveEarnings | null>(null);
  const liveRef = useRef(live);
  const pRef = useRef(p);
  const acc = useRef({ init: false, earned: 0, today: 0, target: 0, targetToday: 0, simExtra: 0, last: 0, lastUi: 0 });

  useEffect(() => {
    liveRef.current = live;
    if (!live.presentation.active) acc.current.simExtra = 0;
  }, [live]);

  useEffect(() => {
    pRef.current = p;
    if (!p) return;
    const a = acc.current;
    const latency = Math.max(0, (Date.now() - p.asOf) / 1000);
    a.target = p.earnedCop + p.ratePerSecondCop * latency;
    a.targetToday = p.earnedTodayCop + p.ratePerSecondCop * latency;
    if (!a.init) {
      a.earned = a.target;
      a.today = a.targetToday;
      a.init = true;
    }
  }, [p]);

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const a = acc.current;
      const P = pRef.current;
      const L = liveRef.current;
      const dt = a.last ? Math.min(0.5, (t - a.last) / 1000) : 0;
      a.last = t;
      if (!P || !a.init) return;
      const reading = L.payload?.reading;
      const share = P.kw / P.capacityKwp;
      const ratePerSec = reading ? (reading.deliveredKw * share * reading.tariffCopPerKwh * P.netFactor) / 3600 : P.ratePerSecondCop;
      if (L.presentation.active) {
        a.simExtra += ratePerSec * dt * L.presentation.speed;
        a.target += P.ratePerSecondCop * dt;
        a.targetToday += P.ratePerSecondCop * dt;
      } else {
        a.target += ratePerSec * dt;
        a.targetToday += ratePerSec * dt;
      }
      const k = Math.min(1, dt / 1.2);
      a.earned += (a.target - a.earned) * k;
      a.today += (a.targetToday - a.today) * k;
      if (t - a.lastUi > 110) {
        a.lastUi = t;
        setView({
          earned: a.earned + a.simExtra,
          today: a.today + a.simExtra,
          ratePerHour: ratePerSec * 3600,
          myKw: reading ? reading.deliveredKw * share : 0,
          simulated: L.presentation.active,
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return view;
}
