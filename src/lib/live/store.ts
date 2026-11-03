"use client";
/**
 * Estado en vivo compartido por toda la pestaña:
 * - una sola conexión SSE a /api/telemetry/stream (hora real)
 * - o, en Modo presentación, el mismo motor calculado en el navegador a una
 *   hora simulada y con velocidad ajustable. Nada de esto se guarda en la BD.
 */
import { ECONOMICS, type Economics } from "@/config/economics";
import { PLANT, type PlantSpec } from "@/config/plant";
import { livePayload, type LivePayload } from "@/lib/telemetry/live";

export type LiveStatus = "connecting" | "live" | "offline" | "simulated";

export interface Presentation {
  active: boolean;
  /** instante real en que se fijó la hora simulada */
  anchorReal: number;
  /** hora simulada en ese instante */
  anchorSim: number;
  speed: number;
}

export interface LiveState {
  payload: LivePayload | null;
  status: LiveStatus;
  presentation: Presentation;
}

const STORAGE_KEY = "solaxy:presentacion";

function loadPresentation(): Presentation {
  const off: Presentation = { active: false, anchorReal: 0, anchorSim: 0, speed: 1 };
  if (typeof window === "undefined") return off;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return off;
    const p = JSON.parse(raw) as Presentation;
    return p && typeof p.active === "boolean" ? p : off;
  } catch {
    return off;
  }
}

let liveSpec: PlantSpec = PLANT;
let liveEcon: Economics = ECONOMICS;

let state: LiveState = { payload: null, status: "connecting", presentation: loadPresentation() };
const listeners = new Set<() => void>();
let source: EventSource | null = null;
let simTimer: ReturnType<typeof setInterval> | null = null;
let offlineTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: Partial<LiveState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

/** Hora del sistema: real, o simulada si el Modo presentación está activo. */
export function currentTime(p: Presentation = state.presentation) {
  return p.active ? p.anchorSim + (Date.now() - p.anchorReal) * p.speed : Date.now();
}

function stopAll() {
  source?.close();
  source = null;
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
  if (offlineTimer) clearTimeout(offlineTimer);
  offlineTimer = null;
}

function startSimulation() {
  const tick = () => emit({ payload: livePayload(liveSpec, currentTime(), liveEcon), status: "simulated" });
  tick();
  simTimer = setInterval(tick, 250);
}

function startStream() {
  // Mientras conecta (o si falla), el navegador calcula con el mismo modelo:
  // la pantalla nunca se queda vacía.
  if (!state.payload) emit({ payload: livePayload(liveSpec, Date.now(), liveEcon) });
  source = new EventSource("/api/telemetry/stream");
  source.onmessage = (ev) => {
    if (offlineTimer) clearTimeout(offlineTimer);
    offlineTimer = setTimeout(() => emit({ status: "offline" }), 8000);
    try {
      emit({ payload: JSON.parse(ev.data) as LivePayload, status: "live" });
    } catch {
      /* mensaje incompleto: se ignora */
    }
  };
  source.onerror = () => {
    emit({ status: "offline", payload: livePayload(liveSpec, Date.now(), liveEcon) });
  };
}

function restart() {
  stopAll();
  if (listeners.size === 0) return;
  if (state.presentation.active) startSimulation();
  else startStream();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) restart();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopAll();
  };
}

export const getSnapshot = () => state;

const serverState: LiveState = {
  payload: null,
  status: "connecting",
  presentation: { active: false, anchorReal: 0, anchorSim: 0, speed: 1 },
};
export const getServerSnapshot = () => serverState;

export function setPresentation(next: { active: boolean; at?: number; speed?: number }) {
  const p: Presentation = next.active
    ? {
        active: true,
        anchorReal: Date.now(),
        anchorSim: next.at ?? currentTime(),
        speed: next.speed ?? state.presentation.speed ?? 1,
      }
    : { active: false, anchorReal: 0, anchorSim: 0, speed: 1 };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* almacenamiento no disponible: solo dura esta vista */
  }
  emit({ presentation: p, payload: p.active ? livePayload(liveSpec, currentTime(p), liveEcon) : state.payload });
  restart();
}

/** La configuración de la planta cambió (la edita el administrador). */
export function setLiveConfig(spec: PlantSpec, econ: Economics) {
  liveSpec = spec;
  liveEcon = econ;
  if (state.presentation.active) emit({ payload: livePayload(liveSpec, currentTime(), liveEcon) });
}
