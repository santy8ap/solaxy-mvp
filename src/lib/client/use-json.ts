"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { loginHref } from "@/lib/navigation";

interface Snapshot {
  data?: unknown;
  error?: string;
  loading: boolean;
  /** Hora de este dispositivo cuando llegó la respuesta: sirve para sincronizar con el reloj del servidor. */
  receivedAt?: number;
}

interface Entry extends Snapshot {
  inflight?: Promise<void>;
  listeners: Set<() => void>;
  snapshot: Snapshot;
  refreshers: Map<number, number>;
  intervalMs?: number;
  timer?: ReturnType<typeof setInterval>;
}

const entries = new Map<string, Entry>();

function entry(url: string): Entry {
  let e = entries.get(url);
  if (!e) {
    e = {
      loading: true,
      listeners: new Set(),
      snapshot: { loading: true },
      refreshers: new Map(),
    };
    entries.set(url, e);
  }
  return e;
}

function publish(e: Entry) {
  e.snapshot = {
    data: e.data,
    error: e.error,
    loading: e.loading,
    receivedAt: e.receivedAt,
  };
  for (const l of e.listeners) l();
}

/** Vuelve a pedir la URL (compartido entre todos los componentes que la usan). */
export function refetch(url: string): Promise<void> {
  const e = entry(url);
  if (e.inflight) return e.inflight;
  e.inflight = fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.replace(
          loginHref(`${window.location.pathname}${window.location.search}`),
        );
        return;
      }
      if (!res.ok)
        throw new Error(
          (json as { error?: string }).error ?? `Error ${res.status}`,
        );
      e.data = json;
      e.receivedAt = Date.now();
      e.error = undefined;
    })
    .catch((err: Error) => {
      e.error = err.message || "No se pudo cargar";
    })
    .finally(() => {
      e.loading = false;
      e.inflight = undefined;
      publish(e);
    });
  return e.inflight;
}

const SERVER = { loading: true } as const;

/** Invalida también los filtros que no están montados para que un pago nuevo aparezca al volver. */
export function invalidateJson(prefix: string) {
  for (const [url, e] of entries) {
    if (!url.startsWith(prefix)) continue;
    e.data = undefined;
    e.error = undefined;
    e.loading = true;
    publish(e);
    if (e.inflight) void e.inflight.then(() => refetch(url));
    else if (e.listeners.size) void refetch(url);
  }
}

export function useJson<T>(
  url: string,
  { refreshMs }: { refreshMs?: number } = {},
) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const e = entry(url);
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    [url],
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => entry(url).snapshot,
    () => SERVER,
  );

  useEffect(() => {
    const e = entry(url);
    if (e.data === undefined && !e.inflight) void refetch(url);
    if (!refreshMs) return;
    const schedule = () => {
      const minimum = Math.min(...e.refreshers.keys());
      if (e.intervalMs === minimum) return;
      if (e.timer) clearInterval(e.timer);
      e.intervalMs = minimum;
      e.timer = Number.isFinite(minimum)
        ? setInterval(() => void refetch(url), minimum)
        : undefined;
    };
    e.refreshers.set(refreshMs, (e.refreshers.get(refreshMs) ?? 0) + 1);
    schedule();
    return () => {
      const count = (e.refreshers.get(refreshMs) ?? 1) - 1;
      if (count > 0) e.refreshers.set(refreshMs, count);
      else e.refreshers.delete(refreshMs);
      schedule();
    };
  }, [url, refreshMs]);

  return {
    data: snap.data as T | undefined,
    receivedAt: snap.receivedAt,
    error: snap.error,
    loading: snap.loading,
    reload: () => refetch(url),
  };
}

export async function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (json as { error?: string }).error ?? `Error ${res.status}`,
    );
  return json as T;
}
