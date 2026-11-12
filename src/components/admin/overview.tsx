"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatNumber, formatPct } from "@/lib/format";
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

interface Pending {
  n: number;
  title: string;
  detail: string;
  href: string;
}

/** Lo que espera al administrador, de lo más urgente a lo que conviene mirar pronto. */
function pendingOf(d: OverviewDTO): Pending[] {
  const items: Pending[] = [
    { n: d.transfersToConfirm, title: d.transfersToConfirm === 1 ? "Transferencia por confirmar" : "Transferencias por confirmar", detail: d.transfersToConfirm === 1 ? "Búscala en el banco con su referencia y confírmala para activar el mes." : "Búscalas en el banco con su referencia y confírmalas para activar cada mes.", href: "/admin/pagos?estado=en_proceso&metodo=transferencia" },
    { n: d.pendingWithdrawals, title: d.pendingWithdrawals === 1 ? "Retiro por pagar" : "Retiros por pagar", detail: `${formatCop(d.pendingWithdrawalsCop)} apartados mientras haces el envío.`, href: "/admin/retiros" },
    { n: d.paymentsToRefund, title: d.paymentsToRefund === 1 ? "Pago por devolver" : "Pagos por devolver", detail: d.paymentsToRefund === 1 ? "Llegó pero no activó un mes. Devuélvelo y márcalo como reembolsado." : "Llegaron pero no activaron un mes. Devuélvelos y márcalos como reembolsados.", href: "/admin/pagos?estado=por_reembolsar" },
    { n: d.reviewsPending, title: d.reviewsPending === 1 ? "Devolución por conciliar" : "Devoluciones por conciliar", detail: d.reviewsPending === 1 ? "Mercado Pago devolvió un pago: esa cuenta no puede retirar hasta que registres la conciliación." : "Mercado Pago devolvió pagos: esas cuentas no pueden retirar hasta que registres la conciliación.", href: "/admin/pagos?estado=por_reembolsar" },
    { n: d.dataRequests, title: d.dataRequests === 1 ? "Solicitud de eliminación de datos" : "Solicitudes de eliminación de datos", detail: "La ley da 15 días hábiles para responder. Revisa si se puede eliminar la cuenta o responde por qué todavía no.", href: "/admin/clientes?estado=solicitudes" },
    { n: d.pausedPlans, title: d.pausedPlans === 1 ? "Plan en pausa por falta de pago" : "Planes en pausa por falta de pago", detail: d.pausedPlans === 1 ? "Escríbele antes de que se cierre: tiene 15 días para pagar." : "Escríbeles antes de que se cierren: tienen 15 días para pagar.", href: "/admin/clientes?estado=en_pausa" },
    { n: d.dueSoon, title: d.dueSoon === 1 ? "Mensualidad que vence esta semana" : "Mensualidades que vencen esta semana", detail: d.dueSoon === 1 ? "Recuérdale el pago para que su energía no se detenga." : "Recuérdales el pago para que su energía no se detenga.", href: "/admin/analisis#vienen" },
  ];
  return items.filter((i) => i.n > 0);
}

function PendingList({ items }: { items: Pending[] }) {
  if (!items.length) return <p className="border-t border-line py-6 text-mute">Nada pendiente: no hay transferencias, retiros ni devoluciones esperando.</p>;
  return (
    <ul className="border-t border-line">
      {items.map((i) => (
        <li key={i.title}>
          <Link href={i.href} className="group flex items-start gap-5 border-b border-line py-4 hover:opacity-80">
            <span className="num min-w-[2.25rem] bg-ink px-2 py-0.5 text-center text-sm text-void">{i.n}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{i.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-mute">{i.detail}</span>
            </span>
            <ArrowRight size={16} strokeWidth={1.5} className="mt-1 shrink-0 text-mute group-hover:text-ink" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
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
  const pending = pendingOf(data);
  const change = data.previousMonthCollectedCop > 0 ? data.monthCollectedCop / data.previousMonthCollectedCop - 1 : null;
  return (
    <>
      <AdminTopbar title="Resumen" subtitle={`${data.settings.name}, ${data.settings.location}.`} />

      <section className="mb-12" aria-labelledby="pending-title">
        <h2 id="pending-title" className="pb-4 text-xl font-medium">
          Para atender {pending.length > 0 && <span className="num text-mute">{pending.reduce((s, i) => s + i.n, 0)}</span>}
        </h2>
        <PendingList items={pending} />
      </section>

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
        <Stat
          label="Recaudo de este mes"
          value={formatCop(data.monthCollectedCop)}
          note={change == null ? (data.previousMonthCollectedCop ? undefined : "Sin recaudo el mes anterior") : `${change >= 0 ? "+" : "−"}${formatPct(Math.abs(change), 0)} frente al mes anterior`}
          href="/admin/analisis"
        />
        <Stat label="Mensualidades cobradas" value={formatCop(data.collectedCop)} note="Desde el inicio" href="/admin/pagos" />
        <Stat label="Planes generando" value={String(data.activePlans)} note={data.pausedPlans ? `${data.pausedPlans} en pausa por falta de pago` : "Ninguno en pausa"} href="/admin/clientes" />
        <Stat label="Clientes con plan" value={String(data.clients)} note={`${data.registeredClients} ${data.registeredClients === 1 ? "cuenta registrada" : "cuentas registradas"}`} href="/admin/clientes" />
        <Stat label="Se les debe a los clientes" value={formatCop(data.owedCop)} note="Venta de su energía menos lo ya pagado" />
        <Stat label="Pagado en retiros" value={formatCop(data.paidOutCop)} href="/admin/retiros" />
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
