"use client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { BusinessAnalytics, MonthStats, Renewal } from "@/lib/admin/analytics";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatDate, formatNumber, formatPct } from "@/lib/format";
import { methodLabel } from "@/components/panel/tx-meta";
import { ErrorNote } from "@/components/ui/field";
import { AdminTopbar } from "./shell";

/** $ 83,5 M: para los rótulos cortos de las gráficas. El valor exacto está en el tooltip y en la tabla. */
function shortCop(n: number) {
  if (n >= 1_000_000) return `$ ${formatNumber(n / 1_000_000, n >= 100_000_000 ? 0 : 1)} M`;
  if (n >= 1_000) return `$ ${formatNumber(n / 1_000, 0)} mil`;
  return formatCop(n);
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-b border-line py-5 pr-6">
      <dt className="cap">{label}</dt>
      <dd className="num mt-2 text-[1.5rem] leading-tight">{value}</dd>
      {note && <dd className="mt-1.5 text-xs leading-relaxed text-mute">{note}</dd>}
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-line-strong pt-7" aria-labelledby={id}>
      <h2 id={id} className="text-xl font-medium">
        {title}
      </h2>
      {note && <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-mute">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Recaudo por mes: columnas de un solo tono sobre una base común; el valor exacto al pasar el cursor o con el teclado. */
function MonthlyChart({ months }: { months: MonthStats[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...months.map((m) => m.collectedCop), 1);
  const last = months.length - 1;
  const shown = active ?? null;
  return (
    <div className="relative">
      <div className="flex items-baseline justify-between text-xs text-mute">
        <span className="num">{shortCop(max)}</span>
      </div>
      <ul className="relative mt-1 flex h-48 items-end border-b border-line-strong border-t border-t-line" aria-label="Recaudo por mes, de los últimos 12 meses">
        {months.map((m, i) => {
          const h = (m.collectedCop / max) * 100;
          return (
            <li
              key={m.month}
              tabIndex={0}
              aria-label={`${m.label}: ${formatCop(m.collectedCop)}, ${m.payments} ${m.payments === 1 ? "pago" : "pagos"}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive((v) => (v === i ? null : v))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((v) => (v === i ? null : v))}
              className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none focus-visible:bg-line/40"
            >
              {i === last && m.collectedCop > 0 && m.collectedCop < max && (
                <span className="num pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.7rem] text-fog" style={{ bottom: `calc(${h}% + 6px)` }}>
                  {shortCop(m.collectedCop)}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`block w-[min(24px,60%)] rounded-t-[4px] transition-opacity ${m.collectedCop > 0 ? "bg-ink" : ""} ${shown != null && shown !== i ? "opacity-40" : ""}`}
                style={{ height: `${h}%` }}
              />
            </li>
          );
        })}
      </ul>
      <ol className="mt-2 flex" aria-hidden="true">
        {months.map((m, i) => (
          <li key={m.month} className={`flex-1 text-center text-[0.65rem] text-mute ${i % 2 && i !== last ? "max-sm:invisible" : ""}`}>
            {m.label.slice(0, 3)}
          </li>
        ))}
      </ol>
      {shown != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 border border-line-strong bg-void px-3 py-2 text-sm shadow-lg"
          style={{ left: `${((shown + 0.5) / months.length) * 100}%` }}
        >
          <p className="num whitespace-nowrap font-medium">{formatCop(months[shown].collectedCop)}</p>
          <p className="whitespace-nowrap text-xs text-mute">
            {months[shown].label} · {months[shown].payments} {months[shown].payments === 1 ? "pago" : "pagos"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Una fila de barra con su nombre y su cifra (medios de pago, embudo, cupo). */
function MeterRow({ name, share, figure, note }: { name: string; share: number; figure: string; note?: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-2 border-b border-line py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        {note && <p className="mt-0.5 text-xs text-mute">{note}</p>}
      </div>
      <p className="num text-right text-sm sm:order-last">{figure}</p>
      <div className="col-span-2 h-2 rounded-full bg-line/60 sm:col-span-1" aria-hidden="true">
        <div className="h-2 rounded-full bg-ink" style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
      </div>
    </li>
  );
}

function RenewalList({ items, empty, kind }: { items: Renewal[]; empty: string; kind: "pronto" | "pausa" }) {
  if (!items.length) return <p className="py-4 text-sm text-mute">{empty}</p>;
  return (
    <ul>
      {items.map((r) => (
        <li key={r.subscriptionId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-3 text-sm">
          <div className="min-w-0">
            <Link href={`/admin/clientes?q=${encodeURIComponent(r.customer)}`} className="link font-medium">
              {r.customer}
            </Link>
            <p className="mt-0.5 text-mute">
              {r.planName}, mes {r.nextMonth} de {r.months}.{" "}
              {kind === "pausa" && r.graceEndsAt ? `Puede pagar hasta el ${formatDate(r.graceEndsAt)}; después el plan se cierra.` : `Vence el ${formatDate(r.dueAt)}.`}
            </p>
          </div>
          <span className="num">{formatCop(r.amountCop)}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminAnalytics() {
  const { data, error } = useJson<BusinessAnalytics>("/api/admin/analytics", { refreshMs: 60_000 });
  if (!data)
    return (
      <>
        <AdminTopbar title="Análisis" />
        {error ? <ErrorNote>{error}</ErrorNote> : <div className="skeleton h-[480px]" aria-busy="true" aria-label="Cargando el análisis" />}
      </>
    );

  const current = data.months[data.months.length - 1];
  const previous = data.months[data.months.length - 2];
  const change = previous && previous.collectedCop > 0 ? current.collectedCop / previous.collectedCop - 1 : null;
  const totalMethods = data.methods.reduce((s, m) => s + m.cop, 0);
  const f = data.funnel;
  const step = (n: number) => (f.registered ? n / f.registered : 0);
  const used = data.capacity.plantDailyKwh ? data.capacity.contractedDailyKwh / data.capacity.plantDailyKwh : 0;

  return (
    <>
      <AdminTopbar title="Análisis" subtitle="Cuánto entra y por dónde, cómo avanzan los clientes y qué mensualidades vienen. En hora de Colombia." />

      <dl className="grid border-t border-line-strong sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={`Recaudo de ${current.label}`}
          value={formatCop(current.collectedCop)}
          note={change == null ? `${current.payments} ${current.payments === 1 ? "pago" : "pagos"} este mes` : `${change >= 0 ? "+" : "−"}${formatPct(Math.abs(change), 0)} frente a ${previous.label}`}
        />
        <Tile label="Últimos 12 meses" value={formatCop(data.totals.collectedCop)} note={`${data.totals.payments} ${data.totals.payments === 1 ? "pago" : "pagos"}`} />
        <Tile label="Pago promedio" value={formatCop(data.totals.averageTicketCop)} note="Por mensualidad, últimos 12 meses" />
        <Tile label="Por entrar en 30 días" value={formatCop(data.expectedNext30Cop)} note="Mensualidades por vencer y en pausa" />
      </dl>

      <Section id="mensual" title="Recaudo por mes" note="Mensualidades confirmadas en cada mes. Pasa el cursor o usa el tabulador sobre una columna para ver el valor exacto.">
        <MonthlyChart months={data.months} />
        <details className="mt-6 text-sm">
          <summary className="link cursor-pointer text-fog">Ver los datos de cada mes en una tabla</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="cap">
                <tr className="border-b border-line-strong">
                  <th className="py-2 pr-4 font-normal">Mes</th>
                  <th className="py-2 pr-4 text-right font-normal">Recaudo</th>
                  <th className="py-2 pr-4 text-right font-normal">Pagos</th>
                  <th className="py-2 pr-4 text-right font-normal">Retiros pagados</th>
                  <th className="py-2 pr-4 text-right font-normal">Clientes nuevos</th>
                  <th className="py-2 text-right font-normal">Planes nuevos</th>
                </tr>
              </thead>
              <tbody className="num">
                {[...data.months].reverse().map((m) => (
                  <tr key={m.month} className="border-b border-line">
                    <td className="py-2 pr-4">{m.label}</td>
                    <td className="py-2 pr-4 text-right">{formatCop(m.collectedCop)}</td>
                    <td className="py-2 pr-4 text-right">{m.payments}</td>
                    <td className="py-2 pr-4 text-right">{formatCop(m.withdrawnCop)}</td>
                    <td className="py-2 pr-4 text-right">{m.newClients}</td>
                    <td className="py-2 text-right">{m.newPlans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      <div className="grid gap-x-16 lg:grid-cols-2">
        <Section id="medios" title="Medios de pago" note="Cómo pagaron los clientes en los últimos 12 meses.">
          {data.methods.length ? (
            <ul className="border-t border-line">
              {data.methods.map((m) => (
                <MeterRow
                  key={m.method}
                  name={m.method === "manual" ? "Registrado a mano" : methodLabel(m.method)}
                  share={totalMethods ? m.cop / totalMethods : 0}
                  figure={`${formatCop(m.cop)} · ${formatPct(totalMethods ? m.cop / totalMethods : 0, 0)}`}
                  note={`${m.payments} ${m.payments === 1 ? "pago" : "pagos"}`}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Todavía no hay pagos confirmados.</p>
          )}
        </Section>

        <Section id="embudo" title="Embudo de clientes" note="Cuántos de los registrados llegan a cada paso. Sin la cuenta de pruebas.">
          <ul className="border-t border-line">
            <MeterRow name="Se registraron" share={1} figure={formatNumber(f.registered)} note="Entraron con Google" />
            <MeterRow name="Completaron sus datos" share={step(f.withProfile)} figure={`${formatNumber(f.withProfile)} · ${formatPct(step(f.withProfile), 0)}`} note="Y aceptaron los términos vigentes" />
            <MeterRow name="Pagaron al menos un mes" share={step(f.paid)} figure={`${formatNumber(f.paid)} · ${formatPct(step(f.paid), 0)}`} />
            <MeterRow name="Tienen un plan vigente" share={step(f.active)} figure={`${formatNumber(f.active)} · ${formatPct(step(f.active), 0)}`} note="Generando, en pausa o en conciliación" />
          </ul>
        </Section>
      </div>

      <Section id="vienen" title="Mensualidades que vienen" note="Para escribirle a cada cliente antes de que su plan se pause o se cierre.">
        <div className="grid gap-x-16 gap-y-10 lg:grid-cols-2">
          <div>
            <h3 className="cap">Vencen en los próximos 7 días · {data.dueSoon.length}</h3>
            <div className="mt-2 border-t border-line">
              <RenewalList items={data.dueSoon} empty="Ninguna vence esta semana." kind="pronto" />
            </div>
          </div>
          <div>
            <h3 className="cap">En pausa, sin pagar · {data.paused.length}</h3>
            <div className="mt-2 border-t border-line">
              <RenewalList items={data.paused} empty="Ningún plan está en pausa." kind="pausa" />
            </div>
          </div>
        </div>
        <p className="mt-6 text-sm text-mute">
          {data.closedUnpaid30d
            ? `${data.closedUnpaid30d} ${data.closedUnpaid30d === 1 ? "plan se cerró" : "planes se cerraron"} por falta de pago en los últimos 30 días.`
            : "Ningún plan se cerró por falta de pago en los últimos 30 días."}
        </p>
      </Section>

      <Section id="cupo" title="Cupo de la planta" note="La energía diaria vendida en planes vigentes frente a lo que la planta entrega al día.">
        <ul className="border-t border-line">
          <MeterRow
            name="Contratado"
            share={used}
            figure={`${formatNumber(data.capacity.contractedDailyKwh)} de ${formatNumber(data.capacity.plantDailyKwh)} kWh · ${formatPct(used, 1)}`}
            note={`Quedan ${formatNumber(Math.max(0, data.capacity.plantDailyKwh - data.capacity.contractedDailyKwh))} kWh al día para planes nuevos`}
          />
        </ul>
      </Section>

      <Section id="visitas" title="Visitas a la página" note="Las visitas, de dónde llegan y la velocidad real de cada página las mide Vercel, sin cookies. No se mide el admin y las direcciones se envían sin parámetros.">
        <p className="max-w-[70ch] text-sm leading-relaxed text-fog">En Vercel, abre el proyecto y entra a «Analytics» para las visitas, o a «Speed Insights» para la velocidad. Los datos empiezan a aparecer después del primer despliegue con la analítica activada.</p>
        <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="btn btn-ghost mt-5 inline-flex items-center gap-2">
          Abrir Vercel <ExternalLink size={14} aria-hidden="true" />
        </a>
      </Section>
    </>
  );
}
