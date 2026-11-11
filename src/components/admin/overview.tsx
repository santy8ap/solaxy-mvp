"use client";
import Link from "next/link";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatNumber } from "@/lib/format";
import { ErrorNote } from "@/components/ui/field";
import { AuditList } from "./activity";
import { AdminTopbar } from "./shell";
import type { OverviewDTO } from "./types";

function Stat({ label, value, note, href, alert = false }: { label: string; value: string; note?: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <dt className="cap">{label}</dt>
      <dd className={`num mt-2 text-[1.5rem] leading-tight ${alert ? "inline-block bg-ink px-2 text-void" : ""}`}>{value}</dd>
      {note && <dd className="mt-1.5 text-xs leading-relaxed text-mute">{note}</dd>}
    </>
  );
  return <div className="border-b border-line py-5 pr-6">{href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : body}</div>;
}

export function AdminOverview() {
  const { data, error } = useJson<OverviewDTO>("/api/admin/overview", { refreshMs: 15_000 });
  if (!data) {
    return (
      <>
        <AdminTopbar title="Resumen" />
        {error ? <ErrorNote>{error}</ErrorNote> : <div className="skeleton h-[420px]" aria-busy="true" />}
      </>
    );
  }
  const used = data.plantDailyKwh > 0 ? data.contractedDailyKwh / data.plantDailyKwh : 0;
  return (
    <>
      <AdminTopbar title="Resumen" subtitle={`${data.settings.name}, ${data.settings.location}.`} />

      <section className="border-t border-line-strong pt-7" aria-label="Cupo de la planta">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="cap">Energía contratada al día</p>
            <p className="figure mt-3 text-[clamp(3rem,8vw,5.5rem)]">
              {formatNumber(data.contractedDailyKwh)}
              <span className="ml-3 text-[0.3em] font-normal text-mute">de {formatNumber(data.plantDailyKwh)} kWh</span>
            </p>
          </div>
          <p className="num pb-2 text-lg">{formatNumber(used * 100, 1)} % del cupo</p>
        </div>
        <div className="relative mt-5 h-px bg-line-strong" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)} aria-label="Cupo de la planta contratado">
          <span className="absolute -top-px left-0 h-[3px] bg-ink" style={{ width: `${Math.min(1, used) * 100}%` }} />
        </div>
        <p className="mt-3 text-sm text-mute">Quedan {formatNumber(data.availableDailyKwh)} kWh al día para planes nuevos.</p>
      </section>

      <dl className="mt-10 grid border-t border-line-strong sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Planes generando" value={String(data.activePlans)} note={data.pausedPlans ? `${data.pausedPlans} en pausa por falta de pago` : `${data.clients} ${data.clients === 1 ? "empresa" : "empresas"}`} href="/admin/clientes" />
        <Stat label="Mensualidades cobradas" value={formatCop(data.collectedCop)} href="/admin/pagos" />
        <Stat label="Se les debe a los clientes" value={formatCop(data.owedCop)} note="Venta de su energía menos lo ya pagado" />
        <Stat label="Pagado en retiros" value={formatCop(data.paidOutCop)} href="/admin/retiros" />
        <Stat label="Retiros por revisar" value={String(data.pendingWithdrawals)} note={data.pendingWithdrawals ? formatCop(data.pendingWithdrawalsCop) : "Ninguno pendiente"} href="/admin/retiros" alert={data.pendingWithdrawals > 0} />
        <Stat label="Pagos por reembolsar" value={String(data.paymentsToRefund)} note={data.paymentsToRefund ? "Llegaron pero no activaron un mes" : "Ninguno"} href="/admin/pagos" alert={data.paymentsToRefund > 0} />
        <Stat label="Energía generada" value={`${formatNumber(data.generatedKwh)} kWh`} note="Por todos los planes" />
        <Stat label="Precio de venta" value={`${formatCop(data.settings.saleCopPerKwh)} / kWh`} href="/admin/planta" />
      </dl>

      <section className="mt-14" aria-label="Actividad reciente">
        <div className="flex items-end justify-between gap-6 border-b border-line-strong pb-4">
          <h2 className="text-xl font-medium">Actividad reciente</h2>
          <Link href="/admin/actividad" className="link text-sm text-fog">
            Ver toda
          </Link>
        </div>
        {data.recent.length ? <AuditList entries={data.recent} /> : <p className="py-8 text-mute">Todavía no hay actividad registrada.</p>}
      </section>
    </>
  );
}
