"use client";
import { useSyncExternalStore } from "react";
import type { EnergyPlan } from "@/config/energy-plans";
import { parseSavedPlans, type SavedPlan } from "./saved-plan-data";
const KEY = "iwe:saved-plans:v1";
const EVENT = "iwe:saved-plans";
const EMPTY: readonly SavedPlan[] = [];
let memory: readonly SavedPlan[] | null = null;
let cachedRaw: string | null | undefined = undefined;
let cached: readonly SavedPlan[] = EMPTY;
function snapshot() {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseSavedPlans(raw);
  }
  return cached;
}
function subscribe(listener: () => void) {
  const external = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      memory = null;
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", external);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", external);
  };
}
function write(plans: readonly SavedPlan[]) {
  memory = plans;
  let persisted = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(plans));
  } catch {
    persisted = false;
  }
  window.dispatchEvent(new Event(EVENT));
  return persisted;
}
export function useSavedPlans() {
  const plans = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return {
    plans,
    save: (planId: EnergyPlan["id"]) =>
      write([
        { planId, savedAt: Date.now() },
        ...snapshot().filter((plan) => plan.planId !== planId),
      ]),
    remove: (planId: EnergyPlan["id"]) =>
      write(snapshot().filter((plan) => plan.planId !== planId)),
  };
}
