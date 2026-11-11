"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatCop, formatNumber } from "@/lib/format";
import { Topbar } from "@/components/panel/shell";
import { usePortfolio } from "@/components/panel/use-portfolio";
import { CheckoutDialog, type CheckoutRequest } from "./checkout";
import { PlanRow } from "./plan-row";
import { PlansTable } from "./plans-table";
import { ProfitPreview } from "./profit-preview";

/** Comprar un plan y pagar los meses de los planes que ya se tienen. */
export function PlansPage() {
  const { catalog } = useCatalog();
  const { data, now } = usePortfolio();
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const preselected = useSearchParams().get("plan");
  const [opened, setOpened] = useState(false);
  const subs = data?.subscriptions ?? [];
  const payable = subs.filter((s) => s.state === "activa" || s.state === "en_pausa");

  const buy = (planId: string) => {
    const p = catalog.plans.find((x) => x.id === planId);
    if (p?.available) setCheckout({ planId: p.id, planName: p.name, periodIndex: 1, months: p.months, kwh: p.monthlyKwh, amountCop: p.monthlyCop, priceCopPerKwh: p.priceCopPerKwh, saleCopPerKwh: p.saleCopPerKwh });
  };

  // Si llega desde el inicio con un plan elegido (?plan=p360), se abre su pago una sola vez.
  useEffect(() => {
    if (!preselected || opened) return;
    const p = catalog.plans.find((x) => x.id === preselected);
    if (!p?.available) return;
    const t = setTimeout(() => {
      setOpened(true);
      setCheckout({ planId: p.id, planName: p.name, periodIndex: 1, months: p.months, kwh: p.monthlyKwh, amountCop: p.monthlyCop, priceCopPerKwh: p.priceCopPerKwh, saleCopPerKwh: p.saleCopPerKwh });
    }, 0);
    return () => clearTimeout(t);
  }, [preselected, opened, catalog.plans]);

  const used = catalog.plantDailyKwh > 0 ? catalog.contractedDailyKwh / catalog.plantDailyKwh : 0;

  return (
    <>
      <Topbar title="Planes" subtitle="Cada plan es energía para 3 meses, que se paga mes a mes. Cada pago activa 30 días." />

      {payable.length > 0 && (
        <section className="mb-16" aria-label="Tus planes">
          <h2 className="border-b border-line-strong pb-4 text-xl font-medium">Tus planes</h2>
          <ul>
            {payable.map((s) => (
              <PlanRow key={s.id} sub={s} now={now} onPay={setCheckout} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Comprar un plan">
        <h2 className="text-xl font-medium">{payable.length ? "Comprar otro plan" : "Elige un plan"}</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-mute">
          Toda la energía se vende a {formatCop(catalog.saleCopPerKwh)} el kWh. La utilidad es la diferencia contra el precio de tu plan.
        </p>
        <div className="mt-8">
          <PlansTable
            catalog={catalog}
            selectedId={checkout?.planId ?? null}
            action={(p) =>
              p.available ? (
                <button type="button" className={`btn w-full lg:w-auto ${checkout?.planId === p.id ? "btn-ghost !border-void !text-void" : "btn-solid"}`} onClick={() => buy(p.id)}>
                  Comprar
                </button>
              ) : null
            }
          />
        </div>
        <ProfitPreview key={preselected ?? "catalog"} plans={catalog.plans} initialPlanId={preselected} />
        <div className="mt-8 max-w-[520px]">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-fog">Cupo de la planta</span>
            <span className="num">
              {formatNumber(catalog.availableDailyKwh)} kWh al día disponibles
            </span>
          </div>
          <div className="relative mt-2.5 h-px bg-line-strong" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)} aria-label="Energía de la planta ya contratada">
            <span className="absolute -top-px left-0 h-[3px] bg-ink" style={{ width: `${Math.min(1, used) * 100}%` }} />
          </div>
          <p className="mt-2.5 text-xs text-mute">
            La planta entrega {formatNumber(catalog.plantDailyKwh)} kWh al día; {formatNumber(catalog.contractedDailyKwh)} ya están contratados.
          </p>
        </div>
      </section>

      <CheckoutDialog request={checkout} onClose={() => setCheckout(null)} />
    </>
  );
}
