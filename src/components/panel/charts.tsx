"use client";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioDTO } from "@/lib/portfolio";
import { formatCop, formatCopCompact, formatKw } from "@/lib/format";
import { useAmountPrivacy } from "@/lib/client/use-amount-privacy";
import { PrivateChartPlaceholder } from "@/components/ui/amount-privacy";
import { ChartTooltipCard, SERIES } from "@/components/ui/chart-tooltip";
import { groupIncome, type ChartGrouping } from "./chart-periods";

const dayLabel = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtDate = (iso: string) => dayLabel.format(new Date(`${iso}T12:00:00Z`));

export function GrowthChart({
  p,
  liveEarned,
}: {
  p: PortfolioDTO;
  liveEarned?: number;
}) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { hidden } = useAmountPrivacy();
  const id = useId().replace(/:/g, "");
  const data = [...p.growth]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map((point, index, array) => ({
      date: point.date,
      earnings:
        index === array.length - 1 && liveEarned != null
          ? liveEarned
          : point.earningsCop,
    }));
  if (hidden) return <PrivateChartPlaceholder />;
  return (
    <>
      <fieldset className="chart-periods">
        <legend className="sr-only">Periodo de ingresos acumulados</legend>
        {([7, 30, 90] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={days === value}
            onClick={() => setDays(value)}
          >
            {value} días
          </button>
        ))}
      </fieldset>
      <div className="chart-summary">
        <span>Acumulado al último registro</span>
        <strong>
          {data.length ? formatCop(data[data.length - 1].earnings, 2) : "—"}
        </strong>
      </div>
      <div
        className="h-[260px]"
        role="img"
        aria-label={`Evolución acumulada de ${data.length} registros diarios. Los valores se pueden consultar en la tabla inferior.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={`${id}-growth`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={SERIES.money} stopOpacity={0.4} />
                <stop offset="1" stopColor={SERIES.money} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={SERIES.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              stroke={SERIES.axis}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              minTickGap={36}
            />
            <YAxis
              tickFormatter={(value: number) => formatCopCompact(value)}
              stroke={SERIES.axis}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: "#aaa", strokeOpacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTooltipCard
                    title={fmtDate(point.date)}
                    rows={[
                      {
                        label: "Acumulado",
                        value: formatCop(point.earnings, 2),
                        color: SERIES.money,
                      },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="#ddd"
              strokeWidth={2}
              fill={`url(#${id}-growth)`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>Ver datos de la gráfica</summary>
        <div
          role="region"
          aria-label="Datos de ingresos acumulados"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{formatCop(point.earnings, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function DailyChart({
  p,
  liveToday,
}: {
  p: PortfolioDTO;
  liveToday?: number;
}) {
  const [grouping, setGrouping] = useState<ChartGrouping>("day");
  const { hidden } = useAmountPrivacy();
  const source = p.daily.map((row, index) => ({
    ...row,
    earnedCop:
      index === p.daily.length - 1 && liveToday != null
        ? liveToday
        : row.earnedCop,
  }));
  const data = groupIncome(source, grouping);
  const label = (date: string) =>
    grouping === "month"
      ? monthLabel.format(new Date(`${date}T12:00:00Z`))
      : fmtDate(date);
  const total = data.reduce((sum, row) => sum + row.earned, 0);
  if (hidden) return <PrivateChartPlaceholder />;
  return (
    <>
      <fieldset className="chart-periods">
        <legend className="sr-only">Agrupación de ingresos registrados</legend>
        {(
          [
            ["day", "Día"],
            ["week", "Semana"],
            ["month", "Mes"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={grouping === value}
            onClick={() => setGrouping(value)}
          >
            {text}
          </button>
        ))}
      </fieldset>
      <div className="chart-summary">
        <span>Total de {p.daily.length} días cargados</span>
        <strong>{formatCop(total, 2)}</strong>
      </div>
      <div
        className="h-[260px]"
        role="img"
        aria-label="Ingresos agrupados por periodo. Los valores están disponibles en la tabla inferior."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap={grouping === "day" ? 2 : "30%"}
          >
            <CartesianGrid vertical={false} stroke={SERIES.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={label}
              stroke={SERIES.axis}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              minTickGap={36}
            />
            <YAxis
              tickFormatter={(value: number) => formatCopCompact(value)}
              stroke={SERIES.axis}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTooltipCard
                    title={label(point.date)}
                    rows={[
                      {
                        label: `Ingresos · ${point.days} ${point.days === 1 ? "día" : "días"} registrados`,
                        value: formatCop(point.earned, 2),
                        color: SERIES.money,
                      },
                      {
                        label: "Último registro de potencia",
                        value: formatKw(point.kw, 1),
                        color: SERIES.reference,
                        dashed: true,
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="earned" radius={0} isAnimationActive={false}>
              {data.map((point, index) => (
                <Cell
                  key={point.date}
                  fill="#ddd"
                  fillOpacity={index === data.length - 1 ? 0.45 : 0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="table-note">
        Las semanas comienzan el lunes. Cada barra suma únicamente los días
        disponibles; puede representar un periodo parcial.
      </p>
      <details className="chart-data">
        <summary>Ver datos de la gráfica</summary>
        <div
          role="region"
          aria-label="Datos de ingresos por periodo"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Periodo desde</th>
                <th scope="col">Último registro</th>
                <th scope="col">Días</th>
                <th scope="col">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{point.endDate}</td>
                  <td>{point.days}</td>
                  <td>{formatCop(point.earned, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
