"use client";
import { useSyncExternalStore } from "react";

const KEY = "iwe:hide-amounts";
const EVENT = "iwe:amount-privacy";
let fallback: boolean | null = null;
function snapshot() {
  if (fallback !== null) return fallback;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function subscribe(listener: () => void) {
  const external = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    fallback = null;
    listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", external);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", external);
  };
}
/** This preference conceals screen amounts; it stores no account or monetary data. */
export function useAmountPrivacy() {
  const hidden = useSyncExternalStore(subscribe, snapshot, () => true);
  const toggle = () => {
    const next = !snapshot();
    fallback = next;
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* Preference remains available in this tab. */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { hidden, toggle };
}
