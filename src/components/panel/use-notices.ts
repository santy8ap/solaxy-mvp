"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { accountNotices } from "@/lib/notifications";
import { usePortfolio } from "./use-portfolio";
import { useUser } from "./user-context";

const memory = new Map<string, string>();
const EVENT = "xge-notices-read";

export function useNotices() {
  const user = useUser();
  const { data, error, now } = usePortfolio();
  const key = `xge:avisos:${user.id}:leidos`;
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener(EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(EVENT, callback);
      window.removeEventListener("storage", callback);
    };
  }, []);
  const read = useCallback(() => {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? "[]";
    } catch {
      return memory.get(key) ?? "[]";
    }
  }, [key]);
  const snapshot = useSyncExternalStore(subscribe, read, () => "[]");
  const seen = useMemo(() => {
    try {
      const parsed = JSON.parse(snapshot);
      return new Set<string>(
        Array.isArray(parsed)
          ? parsed.filter((item) => typeof item === "string")
          : [],
      );
    } catch {
      return new Set<string>();
    }
  }, [snapshot]);
  const notices = useMemo(
    () => (data ? accountNotices(data, now ?? data.asOf) : []),
    [data, now],
  );
  const markRead = (ids: string[]) => {
    const value = JSON.stringify([...new Set([...seen, ...ids])].slice(-2000));
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* El aviso sigue siendo legible sin almacenamiento persistente. */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return {
    notices,
    seen,
    markRead,
    unread: notices.filter((item) => !seen.has(item.id)).length,
    error,
    loaded: !!data,
  };
}
