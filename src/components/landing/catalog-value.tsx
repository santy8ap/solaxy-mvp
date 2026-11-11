"use client";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatCop, formatNumber } from "@/lib/format";

type Pick = "sale" | "lowestPrice" | "topKwh" | "topProfitPct";

/**
 * Una cifra del catálogo vigente dentro de un texto del inicio. Los precios los puede cambiar el
 * administrador: así los textos nunca dicen un precio distinto al de la tabla de planes.
 */
export function CatalogValue({ pick }: { pick: Pick }) {
  const { catalog, loaded } = useCatalog();
  if (!loaded) return <span aria-label="Cargando valor vigente">…</span>;
  // El plan con el kWh más barato: el más grande.
  const top = catalog.plans.reduce(
    (best, p) => (p.priceCopPerKwh < best.priceCopPerKwh ? p : best),
    catalog.plans[0],
  );
  const text =
    pick === "sale"
      ? formatCop(catalog.saleCopPerKwh)
      : pick === "lowestPrice"
        ? formatCop(top.priceCopPerKwh)
        : pick === "topKwh"
          ? formatNumber(top.totalKwh)
          : `${formatNumber(Math.round(top.profitPct * 100))} %`;
  return <span className="whitespace-nowrap">{text}</span>;
}
