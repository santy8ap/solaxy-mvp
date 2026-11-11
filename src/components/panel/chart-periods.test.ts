import { describe, expect, it } from "vitest";
import { groupIncome } from "./chart-periods";
const rows = [
  { date: "2026-12-31", earnedCop: 20.5, kw: 2 },
  { date: "2027-01-01", earnedCop: 30.5, kw: 3 },
  { date: "2027-01-04", earnedCop: 10, kw: 4 },
];
describe("income chart periods", () => {
  it("groups Monday-based weeks correctly across a year boundary", () => {
    expect(groupIncome(rows, "week")).toEqual([
      { date: "2026-12-28", endDate: "2027-01-01", earned: 51, kw: 3, days: 2 },
      { date: "2027-01-04", endDate: "2027-01-04", earned: 10, kw: 4, days: 1 },
    ]);
  });
  it("preserves totals and reports only loaded days in partial months", () => {
    const result = groupIncome([...rows].reverse(), "month");
    expect(result.map((row) => [row.date, row.earned, row.days])).toEqual([
      ["2026-12-01", 20.5, 1],
      ["2027-01-01", 40.5, 2],
    ]);
    expect(result.reduce((sum, row) => sum + row.earned, 0)).toBe(61);
    expect(rows[0].date).toBe("2026-12-31");
    expect(groupIncome([], "day")).toEqual([]);
  });
});
