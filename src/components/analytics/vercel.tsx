"use client";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** Rutas que no se miden: el admin es de uso interno y la API no son páginas. */
const PRIVATE = /^\/(admin|api)(\/|$)/;

/**
 * Lo que se envía a Vercel: la ruta sin parámetros (pueden traer referencias de pago) y nada del admin.
 * Vercel Web Analytics no usa cookies ni guarda datos personales.
 */
export function privateUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (PRIVATE.test(u.pathname)) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

function clean<T extends { url: string }>(event: T): T | null {
  const url = privateUrl(event.url);
  return url ? { ...event, url } : null;
}

/** Visitas (Web Analytics) y velocidad real de las páginas (Speed Insights). Solo funcionan en Vercel. */
export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={(e: BeforeSendEvent) => clean(e)} />
      <SpeedInsights beforeSend={(e) => clean(e)} />
    </>
  );
}
