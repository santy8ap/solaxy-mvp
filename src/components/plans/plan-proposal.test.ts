import { expect, it } from "vitest";
import { ENERGY_PLANS } from "@/config/energy-plans";
import { planProposalHtml } from "./plan-proposal";
it("exports the selected monthly values and safely escapes company details", () => {
  const html = planProposalHtml(ENERGY_PLANS[3], {
    company: "<script>bad()</script>",
    nit: "900123456-8",
    representative: '<img src=x onerror="bad()">',
    email: "qa@example.com",
  });
  expect(html).toContain("76.800.000");
  expect(html).toContain("230.400.000");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).toContain("no es una factura");
});
