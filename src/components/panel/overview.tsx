"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { isoColombiaDate } from "@/lib/history-filters";
import { useState } from "react";
import { isGenerating, nextSunriseMs, sunsetMs } from "@/lib/energy/solar-day";
import { userPowerKw } from "@/lib/energy/plan-math";
import { dailyReturns, type DayReturn } from "@/lib/energy/summary";
import {
  formatCop,
  formatDateTime,
  formatDay,
  formatNumber,
  formatTime,
} from "@/lib/format";
import { PlanRow } from "@/components/plans/plan-row";
import { useProfile } from "@/components/profile/profile-form";
import { SolarClock } from "@/components/solar/solar-clock";
import { ErrorNote } from "@/components/ui/field";
import { Status, TX_STATUS } from "@/components/ui/status";
import { Topbar } from "./shell";
import { txDetail, txTitle } from "./tx-meta";
import { usePortfolio } from "./use-portfolio";
import { useUser } from "./user-context";

function Stat({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="border-t border-line py-5 sm:border-l sm:border-t-0 sm:py-1 sm:pl-7 sm:first:border-l-0 sm:first:pl-0">
      <dt className="cap">{label}</dt>
      <dd className="num mt-2 text-[1.5rem] leading-tight">{children}</dd>
      {note && <dd className="mt-1.5 text-xs text-mute">{note}</dd>}
    </div>
  );
}

/** Una lectura del momento, bajo la cifra principal. */
function Reading({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="cap">{label}</dt>
      <dd className="num mt-2 text-lg">{children}</dd>
    </div>
  );
}

/** Lo que rindieron los planes cada día: energía, venta y utilidad. El día de hoy sigue creciendo. */
function DailyReturns({
  rows,
  fullDayKwh,
  days,
  onDaysChange,
}: {
  rows: DayReturn[];
  fullDayKwh: number;
  days: number;
  onDaysChange(days: number): void;
}) {
  if (!rows.length) return null;
  const max = Math.max(fullDayKwh, ...rows.map((r) => r.kwh), 1);
  return (
    <section className="mt-16" aria-labelledby="daily-title">
      <div className="flex items-end justify-between gap-6 border-b border-line-strong pb-4">
        <h2 id="daily-title" className="text-xl font-medium">
          Rendimiento día a día
        </h2>
        <label className="flex items-center gap-3 text-sm text-mute">
          Período
          <select
            className="field !w-auto !py-2"
            aria-label="Período de rendimientos"
            value={days}
            onChange={(event) => onDaysChange(Number(event.target.value))}
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="link inline-flex items-center gap-2 text-sm text-fog"
          onClick={() =>
            downloadCsv(
              `xge-rendimientos-${isoColombiaDate(rows[0].dayStart)}.csv`,
              [
                [
                  "Fecha (Colombia)",
                  "Energía kWh",
                  "Venta COP",
                  "Utilidad bruta COP",
                ],
                ...rows.map((row) => [
                  isoColombiaDate(row.dayStart),
                  Number(row.kwh.toFixed(2)),
                  Math.floor(row.soldCop),
                  Math.floor(row.profitCop),
                ]),
              ],
            )
          }
        >
          <Download size={14} /> Exportar período
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th scope="col" className="cap py-3 text-left font-medium">
              Día
            </th>
            <td className="hidden md:table-cell" />
            <th scope="col" className="cap py-3 text-right font-medium">
              Energía
            </th>
            <th
              scope="col"
              className="cap hidden py-3 pl-6 text-right font-medium sm:table-cell"
            >
              Venta
            </th>
            <th scope="col" className="cap py-3 pl-6 text-right font-medium">
              Utilidad
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dayStart} className="border-t border-line">
              <th
                scope="row"
                className="whitespace-nowrap py-3.5 pr-4 text-left font-normal"
              >
                {r.today ? "Hoy" : formatDay(r.dayStart)}
              </th>
              <td className="hidden w-[36%] px-6 md:table-cell">
                <span
                  className="relative block h-px bg-line-strong"
                  aria-hidden="true"
                >
                  <span
                    className="absolute -top-px left-0 h-[3px] bg-ink"
                    style={{ width: `${Math.min(1, r.kwh / max) * 100}%` }}
                  />
                </span>
              </td>
              <td className="num whitespace-nowrap py-3.5 text-right">
                {formatNumber(r.kwh, r.today ? 1 : 0)} kWh
              </td>
              <td className="num hidden whitespace-nowrap py-3.5 pl-6 text-right text-fog sm:table-cell">
                {formatCop(Math.floor(r.soldCop))}
              </td>
              <td className="num whitespace-nowrap py-3.5 pl-6 text-right">
                {formatCop(Math.floor(r.profitCop))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Overview() {
  const user = useUser();
  const profile = useProfile();
  const { data, error, now, totals, balanceCop } = usePortfolio();
  const [rangeDays, setRangeDays] = useState(7);
  const name = profile.data?.profile?.companyName || user.name.split(" ")[0];

  if (!data || !totals) {
    return (
      <>
        <Topbar title={`Hola, ${name}`} />
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : (
          <div
            className="skeleton h-[420px]"
            aria-busy="true"
            aria-label="Cargando tu energía"
          />
        )}
      </>
    );
  }

  const subs = data.subscriptions;
  if (!subs.length) {
    return (
      <>
        <Topbar
          title={`Hola, ${name}`}
          subtitle="Todavía no tienes un plan de energía."
        />
        <section className="grid grid-cols-[minmax(0,1fr)] gap-12 border-t border-line-strong pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <h2 className="display text-[clamp(2.5rem,5vw,4rem)]">
              Elige tu primer plan
            </h2>
            <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">
              Compras energía para 3 meses y la pagas mes a mes. Cuando se
              confirma el primer pago, tu energía empieza a contar aquí, segundo
              a segundo, mientras la planta genera.
            </p>
            <Link href="/panel/planes" className="btn btn-solid mt-8">
              Ver los planes
            </Link>
          </div>
          <SolarClock solar={data.solar} now={now} size="panel" />
        </section>
      </>
    );
  }

  const power =
    now == null
      ? 0
      : subs.reduce(
          (s, p) => s + userPowerKw(data.solar, p.dailyKwh, p.periods, now),
          0,
        );
  const todayPct =
    totals.dailyKwh > 0 ? Math.min(1, totals.todayKwh / totals.dailyKwh) : 0;
  const paused = subs.some((s) => s.state === "en_pausa");
  const idle = totals.dailyKwh === 0;
  const recent = data.transactions.slice(0, 4);
  const sunUp = now != null && isGenerating(data.solar, now);
  const days =
    now == null ? [] : dailyReturns(subs, data.solar, now, rangeDays);

  return (
    <>
      <Topbar
        title={`Hola, ${name}`}
        subtitle={
          idle
            ? paused
              ? "Tu energía está en pausa: falta el pago del mes."
              : "Tus planes ya no están generando."
            : "Así va tu energía en este momento."
        }
      />

      <section
        className="grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-10 border-t border-line-strong pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
        aria-label="Energía generada"
      >
        <div>
          <p className="cap">Energía generada</p>
          <p
            className="figure mt-3 text-[clamp(3.4rem,10.5vw,7.75rem)]"
            aria-live="off"
          >
            {formatNumber(totals.generatedKwh, 2)}
            <span className="ml-3 text-[0.32em] font-normal tracking-normal text-mute">
              kWh
            </span>
          </p>
          {!idle && (
            <div className="mt-8">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-fog">Hoy</span>
                <span className="num">
                  {formatNumber(totals.todayKwh, 1)} de{" "}
                  {formatNumber(totals.dailyKwh)} kWh
                </span>
              </div>
              <div
                className="relative mt-2.5 h-px bg-line-strong"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(todayPct * 100)}
                aria-label="Energía de hoy"
              >
                <span
                  className="absolute -top-px left-0 h-[3px] bg-ink"
                  style={{ width: `${todayPct * 100}%` }}
                />
              </div>
            </div>
          )}
          {idle ? (
            <p className="mt-8 max-w-[46ch] text-sm leading-relaxed text-mute">
              Sin un mes activo, tus planes no generan. Lo que ya generaste
              sigue en tu saldo.
            </p>
          ) : (
            <dl className="mt-9 grid grid-cols-2 gap-6">
              <Reading label="Potencia ahora">
                {now == null ? "\u00a0" : `${formatNumber(power, 1)} kW`}
              </Reading>
              <Reading label={sunUp ? "Genera hasta" : "Vuelve a generar"}>
                {now == null
                  ? "\u00a0"
                  : formatTime(
                      sunUp
                        ? sunsetMs(data.solar, now)
                        : nextSunriseMs(data.solar, now),
                    )}
              </Reading>
            </dl>
          )}
        </div>
        <SolarClock
          solar={data.solar}
          now={now}
          size="panel"
          className="self-center"
        />
      </section>

      <dl className="mt-10 grid border-t border-line-strong sm:grid-cols-3 sm:pt-6">
        <Stat label="Venta de tu energía" note="Lo que se abona a tu saldo">
          {formatCop(Math.floor(totals.soldCop))}
        </Stat>
        <Stat
          label="Utilidad"
          note="La venta menos lo que pagaste por esa energía"
        >
          {formatCop(Math.floor(totals.profitCop))}
        </Stat>
        <Stat
          label="Rendimiento diario"
          note={idle ? "Sin un mes activo" : "Utilidad de cada día completo"}
        >
          {formatCop(Math.round(totals.dailyProfitCop))}
        </Stat>
      </dl>

      <DailyReturns
        rows={days}
        fullDayKwh={totals.dailyKwh}
        days={rangeDays}
        onDaysChange={setRangeDays}
      />

      <section className="mt-16" aria-label="Tus planes">
        <div className="flex items-end justify-between gap-6 border-b border-line-strong pb-4">
          <h2 className="text-xl font-medium">Tus planes</h2>
          <Link href="/panel/planes" className="link text-sm text-fog">
            Comprar otro plan
          </Link>
        </div>
        <ul>
          {subs.map((s) => (
            <PlanRow key={s.id} sub={s} now={now} />
          ))}
        </ul>
      </section>

      {/* La columna única del celular también es minmax(0,1fr): si no, el texto truncado de un movimiento ensancha la página. */}
      <section
        className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        aria-label="Saldo y movimientos"
      >
        <div className="border-t border-line-strong pt-5">
          <p className="cap">Saldo disponible</p>
          <p className="figure mt-3 text-[clamp(2.75rem,6vw,4.25rem)]">
            {formatCop(balanceCop)}
          </p>
          {data.reservedCop > 0 && (
            <p className="mt-3 text-sm text-mute">
              Además, {formatCop(data.reservedCop)} en retiros que estamos
              revisando.
            </p>
          )}
          <Link href="/panel/billetera" className="btn btn-ghost mt-7">
            Retirar
          </Link>
        </div>
        <div className="border-t border-line-strong pt-5">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="text-xl font-medium">Últimos movimientos</h2>
            <Link href="/panel/billetera" className="link text-sm text-fog">
              Ver todos
            </Link>
          </div>
          <ul className="mt-3">
            {recent.map((t) => {
              const st = TX_STATUS[t.status] ?? TX_STATUS.pendiente;
              return (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-6 border-b border-line py-4"
                >
                  <div className="min-w-0">
                    <p>{txTitle(t)}</p>
                    <p className="mt-1 truncate text-sm text-mute">
                      {formatDateTime(t.createdAt)}, {txDetail(t)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`num ${st.tone === "off" ? "text-dim line-through" : ""}`}
                    >
                      {formatCop(t.amountCop)}
                    </p>
                    <p className="mt-1.5">
                      <Status tone={st.tone}>{st.label}</Status>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
