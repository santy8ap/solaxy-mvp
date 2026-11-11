"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PortfolioDTO } from "@/lib/portfolio";
import { formatCop, formatCopCompact, formatKw } from "@/lib/format";
import { ChartTooltipCard, SERIES } from "@/components/ui/chart-tooltip";

const dayLabel = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => dayLabel.format(new Date(`${iso}T12:00:00Z`));

export function GrowthChart({ p, liveEarned }: { p: PortfolioDTO; liveEarned?: number }) {
  const data = p.growth.map((g, i) => ({
    date: g.date,
    earnings: i === p.growth.length - 1 && liveEarned != null ? liveEarned : g.earningsCop,
    invested: g.investedCop,
  }));
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-growth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={SERIES.money} stopOpacity={0.5} />
              <stop offset="1" stopColor={SERIES.money} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={SERIES.grid} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke={SERIES.axis} tickLine={false} axisLine={false} fontSize={12} minTickGap={40} />
          <YAxis tickFormatter={(v: number) => formatCopCompact(v)} stroke={SERIES.axis} tickLine={false} axisLine={false} fontSize={12} width={72} />
          <Tooltip
            cursor={{ stroke: "#c1c1c1", strokeOpacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <ChartTooltipCard
                  title={fmtDate(d.date)}
                  rows={[
                    { label: "Ganancias acumuladas", value: formatCop(d.earnings), color: SERIES.money },
                    { label: "Capital invertido", value: formatCop(d.invested), color: SERIES.reference, dashed: true },
                  ]}
                />
              );
            }}
          />
          <Area type="monotone" dataKey="earnings" stroke={SERIES.money} strokeWidth={2} fill="url(#fill-growth)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyChart({ p, liveToday }: { p: PortfolioDTO; liveToday?: number }) {
  const data = p.daily.map((d, i) => ({
    date: d.date,
    earned: i === p.daily.length - 1 && liveToday != null ? liveToday : d.earnedCop,
    kw: d.kw,
    today: i === p.daily.length - 1,
  }));
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={SERIES.grid} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke={SERIES.axis} tickLine={false} axisLine={false} fontSize={12} minTickGap={36} />
          <YAxis tickFormatter={(v: number) => formatCopCompact(v)} stroke={SERIES.axis} tickLine={false} axisLine={false} fontSize={12} width={64} />
          <Tooltip
            cursor={{ fill: "rgba(193,193,193,0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <ChartTooltipCard
                  title={d.today ? `${fmtDate(d.date)} (en curso)` : fmtDate(d.date)}
                  rows={[
                    { label: "Ganancia del día", value: formatCop(d.earned), color: SERIES.money },
                    { label: "Tus kW", value: formatKw(d.kw, 1), color: SERIES.reference },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="earned" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.date} fill={SERIES.money} fillOpacity={d.today ? 0.45 : 0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
