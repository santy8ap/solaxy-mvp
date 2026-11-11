"use client";
import { useJson } from "@/lib/client/use-json";
import { useNow } from "@/lib/client/use-now";
import { summarize } from "@/lib/energy/summary";
import type { PortfolioDTO } from "@/lib/portfolio";

/**
 * El resumen del usuario, vivo: el servidor manda los planes y sus periodos cada 30 segundos y, entre una
 * consulta y otra, el navegador calcula la energía y el dinero con las mismas funciones (lib/energy).
 * El reloj se sincroniza con el del servidor: los contadores no dependen de la hora del dispositivo.
 */
export function usePortfolio() {
  const { data, error, receivedAt, reload } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 30_000 });
  const offset = data && receivedAt ? data.asOf - receivedAt : 0;
  const now = useNow(1000, offset);
  const live = data && now ? summarize(data.subscriptions, data.solar, now) : null;
  const totals = live ?? data ?? null;
  // El saldo nunca se muestra mayor que lo que el servidor aceptaría retirar en este instante.
  const balanceCop = data ? Math.max(0, Math.floor(totals?.soldCop ?? 0) - data.withdrawnCop - data.reservedCop) : 0;
  return { data: data ?? null, error, now, totals, balanceCop, reload };
}
