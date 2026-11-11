import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, FileText, Sun } from "lucide-react";
import { ENERGY_PLANS, planSummary } from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
import { PlanCheckout } from "@/components/plans/plan-checkout";
import { PublicFrame } from "@/components/public/public-frame";
import { requirePlanBuyer } from "@/lib/plan-purchase-access";

// Purchase always waits for the current session; no shared or prerendered auth result.
export const instant = false;

export function generateStaticParams() {
  return ENERGY_PLANS.map((plan) => ({ planId: plan.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/comprar/[planId]">): Promise<Metadata> {
  const { planId } = await params;
  const plan = ENERGY_PLANS.find((option) => option.id === planId);
  return {
    title: plan ? `Comprar plan ${plan.name}` : "Plan no encontrado",
    robots: { index: false, follow: true },
  };
}

async function PurchaseContent({
  params,
}: Pick<PageProps<"/comprar/[planId]">, "params">) {
  const { planId } = await params;
  const { plan } = await requirePlanBuyer(planId);
  const summary = planSummary(plan);

  return (
    <PublicFrame active="planes" authenticated>
      <nav className="purchase-breadcrumb" aria-label="Ruta de navegación">
        <Link href="/#planes"><ArrowLeft size={14} /> Planes de energía</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Comprar plan {plan.name}</span>
      </nav>

      <header className="purchase-heading">
        <div>
          <span className="eyebrow">TU EMPRESA. TU PRÓXIMO PASO.</span>
          <h1>COMPRAR<br /><span>ENERGÍA.</span></h1>
        </div>
        <p>El plan que elegiste, con cada detalle a la vista. Revisa los valores
          y prepara los datos de tu empresa.</p>
      </header>

      <div className="purchase-layout">
        <section className="purchase-form-panel" aria-label="Preparar compra de energía">
          <PlanCheckout key={plan.id} plan={plan} presentation="page" />
        </section>

        <aside className="purchase-summary" aria-labelledby="purchase-summary-title">
          <div className="purchase-receipt">
            <div className="purchase-receipt-top">
              <span className="eyebrow">TU PLAN DE ENERGÍA</span>
              <span className="mono">{plan.id} / 04</span>
            </div>
            <h2 id="purchase-summary-title">{plan.name}</h2>
            <div className="purchase-energy">
              <Sun size={20} aria-hidden="true" />
              <span className="mono">{formatNumber(plan.daily)} <small>kWh / día</small></span>
            </div>
            <dl className="purchase-receipt-details">
              <div><dt>Energía mensual</dt><dd>{formatNumber(summary.monthlyKwh)} kWh</dd></div>
              <div><dt>Precio por kWh</dt><dd>{formatCop(plan.price)} COP</dd></div>
              <div><dt>Duración del plan</dt><dd>3 meses · 90 días</dd></div>
              <div><dt>Energía total</dt><dd>{formatNumber(summary.totalKwh)} kWh</dd></div>
            </dl>
            <div className="purchase-monthly">
              <span className="eyebrow">VALOR MENSUAL DE REFERENCIA</span>
              <p className="mono">{formatCop(summary.monthlyCop)}</p>
              <span>COP / cada 30 días</span>
            </div>
            <div className="purchase-total">
              <span>Total de los 3 meses</span>
              <strong className="mono">{formatCop(summary.monthlyCop * 3)} COP</strong>
            </div>
            <Link className="purchase-change" href={`/planes?plan=${plan.id}`}>
              Cambiar de plan <ArrowUpRight size={14} />
            </Link>
          </div>

          <section className="purchase-schedule" aria-labelledby="purchase-schedule-title">
            <h3 id="purchase-schedule-title"><CalendarDays size={16} /> Así se distribuye tu plan</h3>
            <ol>
              {["Primer mes", "Segundo mes", "Tercer mes"].map((label, index) => (
                <li key={label}>
                  <span className="mono">0{index + 1}</span>
                  <div><strong>{label}</strong><span>Periodo de 30 días</span></div>
                  <span className="mono">{formatCop(summary.monthlyCop)}</span>
                </li>
              ))}
            </ol>
          </section>

          <p className="purchase-availability"><FileText size={17} aria-hidden="true" />
            <span>El cobro mensual aún no está habilitado. Esta vista permite
              preparar y descargar tu propuesta, sin realizar cargos ni activar
              un contrato.</span>
          </p>
        </aside>
      </div>

      <div className="purchase-support">
        <div><span className="eyebrow">ANTES DE CONTINUAR</span>
          <p>¿Una duda sobre tu plan?</p></div>
        <Link href="/ayuda" className="text-link">Consultar el centro de ayuda <ArrowUpRight size={15} /></Link>
        <Link href="/terminos" className="text-link">Términos y condiciones <ArrowUpRight size={15} /></Link>
      </div>
    </PublicFrame>
  );
}

export default function PurchasePage({ params }: PageProps<"/comprar/[planId]">) {
  return (
    <Suspense fallback={
      <main className="eclipse-wrap purchase-session-loading" aria-busy="true">
        <span className="eyebrow">IN WORLD ENERGY</span>
        <h1>Preparando tu compra…</h1>
        <p>Comprobamos tu sesión para continuar con el plan elegido.</p>
      </main>
    }>
      <PurchaseContent params={params} />
    </Suspense>
  );
}
