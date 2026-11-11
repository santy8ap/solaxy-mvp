export type ChartGrouping = "day" | "week" | "month";
export interface DailyIncome {
  date: string;
  earnedCop: number;
  kw: number;
}
export interface IncomeGroup {
  date: string;
  endDate: string;
  earned: number;
  kw: number;
  days: number;
}
function groupKey(date: string, grouping: ChartGrouping) {
  if (grouping === "month") return `${date.slice(0, 7)}-01`;
  if (grouping === "day") return date;
  const time = new Date(`${date}T00:00:00Z`);
  time.setUTCDate(time.getUTCDate() - ((time.getUTCDay() + 6) % 7));
  return time.toISOString().slice(0, 10);
}
/** API dates already represent Colombia calendar days. Group without browser-local conversion. */
export function groupIncome(
  rows: readonly DailyIncome[],
  grouping: ChartGrouping,
): IncomeGroup[] {
  const groups = new Map<string, IncomeGroup>();
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = groupKey(row.date, grouping);
    const previous = groups.get(key);
    if (previous) {
      previous.earned += row.earnedCop;
      previous.kw = row.kw;
      previous.days++;
      previous.endDate = row.date;
    } else
      groups.set(key, {
        date: key,
        endDate: row.date,
        earned: row.earnedCop,
        kw: row.kw,
        days: 1,
      });
  }
  return [...groups.values()];
}
