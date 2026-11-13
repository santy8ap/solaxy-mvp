"use client";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatCop } from "@/lib/format";

export function CatalogPrice() {
  const { catalog, loaded } = useCatalog();
  if (!loaded) return null;

  const prices = catalog.plans
    .filter((plan) => plan.available)
    .map((plan) => plan.priceCopPerKwh);
  return (
    <p className="mt-3 text-sm font-medium text-ink">
      {prices.length
        ? `Desde ${formatCop(Math.min(...prices))} COP por kWh en los planes con cupo.`
        : "Los planes están sin cupo por ahora."}
    </p>
  );
}
