import { MarketError } from "@/lib/errors";
import { DAY_MS, TZ_OFFSET_MS, bogotaMs } from "@/lib/time";

export interface HistoryFilters {
  from?: number;
  until?: number;
  kind?: "plan_mes" | "retiro";
  status?: string;
  page: number;
}

export function colombiaDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new MarketError("Elige una fecha válida.");
  const [year, month, day] = value.split("-").map(Number);
  const time = bogotaMs(year, month, day);
  if (
    !Number.isFinite(time) ||
    new Date(time + TZ_OFFSET_MS).toISOString().slice(0, 10) !== value
  )
    throw new MarketError("Elige una fecha válida.");
  return time;
}

export function historyFilters(search: URLSearchParams): HistoryFilters {
  const from = search.get("desde")
    ? colombiaDate(search.get("desde")!)
    : undefined;
  const until = search.get("hasta")
    ? colombiaDate(search.get("hasta")!) + DAY_MS
    : undefined;
  if (from != null && until != null && from >= until)
    throw new MarketError(
      "La fecha inicial debe ser anterior o igual a la fecha final.",
    );
  const rawKind = search.get("tipo");
  if (rawKind && !["todos", "plan_mes", "retiro"].includes(rawKind))
    throw new MarketError("Tipo de movimiento inválido.");
  const rawStatus = search.get("estado");
  if (rawStatus && !/^[a-z_]{1,24}$/.test(rawStatus))
    throw new MarketError("Estado inválido.");
  const page = Number(search.get("pagina") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000)
    throw new MarketError("Página inválida.");
  return {
    from,
    until,
    kind:
      rawKind && rawKind !== "todos"
        ? (rawKind as HistoryFilters["kind"])
        : undefined,
    status: rawStatus && rawStatus !== "todos" ? rawStatus : undefined,
    page,
  };
}

export const isoColombiaDate = (time: number) =>
  new Date(time + TZ_OFFSET_MS).toISOString().slice(0, 10);
