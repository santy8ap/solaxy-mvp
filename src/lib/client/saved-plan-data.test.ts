import { expect, it } from "vitest";
import { parseSavedPlans } from "./saved-plan-data";
it("recovers only recognized selections and strips company or foreign data", () => {
  expect(
    parseSavedPlans(
      JSON.stringify([
        { planId: "04", savedAt: 20, company: "must not persist" },
        { planId: "04", savedAt: 10 },
        { planId: "01", savedAt: 30 },
        { planId: "external", savedAt: 50 },
        { planId: "02", savedAt: -1 },
        { planId: "03", savedAt: 1e30 },
      ]),
    ),
  ).toEqual([
    { planId: "01", savedAt: 30 },
    { planId: "04", savedAt: 20 },
  ]);
  expect(parseSavedPlans("not json")).toEqual([]);
  expect(parseSavedPlans('{"planId":"01"}')).toEqual([]);
});
