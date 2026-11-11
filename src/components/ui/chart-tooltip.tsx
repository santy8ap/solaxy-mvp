"use client";

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
  dashed?: boolean;
}

/** Tooltip de gráficas: los valores van en tinta de texto; el color solo marca la serie. */
export function ChartTooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[180px] rounded-none border border-silicon-500/60 bg-silicon-950/95 px-3.5 py-3 text-sm shadow-2xl backdrop-blur">
      <div className="num mb-2 font-semibold text-silver-50">{title}</div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-silver-300">
              <span
                className="inline-block h-[3px] w-4 rounded-full"
                style={r.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${r.color} 0 4px, transparent 4px 7px)` } : { background: r.color }}
              />
              {r.label}
            </span>
            <span className="num font-medium text-silver-50">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegendItem({ label, color, dashed = false }: { label: string; color: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-sm text-silver-300">
      <span
        className="inline-block h-[3px] w-5 rounded-full"
        style={dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` } : { background: color }}
      />
      {label}
    </span>
  );
}

export const SERIES = {
  solar: "#8a8a8a",
  battery: "#7c7c7c",
  money: "#838383",
  reference: "#9a9a9a",
  grid: "rgba(154,154,154,0.12)",
  axis: "#787878",
} as const;
