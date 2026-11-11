"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";

interface Entry {
  data?: unknown;
  error?: string;
  loading: boolean;
  inflight?: Promise<void>;
  listeners: Set<() => void>;
  snapshot: { data?: unknown; error?: string; loading: boolean };
}

const entries = new Map<string, Entry>();

function entry(url: string): Entry {
  let e = entries.get(url);
  if (!e) {
    e = { loading: true, listeners: new Set(), snapshot: { loading: true } };
    entries.set(url, e);
  }
  return e;
}

function publish(e: Entry) {
  e.snapshot = { data: e.data, error: e.error, loading: e.loading };
  for (const l of e.listeners) l();
}

/** Vuelve a pedir la URL (compartido entre todos los componentes que la usan). */
export function refetch(url: string): Promise<void> {
  const e = entry(url);
  if (e.inflight) return e.inflight;
  e.inflight = fetch(url, { cache: "no-store" })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // Deja que el componente decida qué mostrar (p. ej. un botón "Iniciar sesión"
        // o un redireccionamiento controlado) en lugar de forzar un replace brusco.
        e.data = undefined;
        e.error = "Sesión expirada. Inicia sesión de nuevo.";
        return;
      }
      if (!res.ok)
        throw new Error(
          (json as { error?: string }).error ?? `Error ${res.status}`,
        );
      e.data = json;
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
    const id = setInterval(() => void refetch(url), refreshMs);
    return () => clearInterval(id);
  }, [url, refreshMs]);

  return {
    data: snap.data as T | undefined,
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
