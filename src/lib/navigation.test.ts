import { describe, expect, it } from "vitest";
import { safeDestination, signInHref } from "./navigation";
describe("authentication return navigation", () => {
  it("keeps known destinations and a valid selected plan", () => {
    expect(safeDestination("/panel/planes?plan=02")).toBe(
      "/panel/planes?plan=02",
    );
    expect(safeDestination("/planes?plan=04&next=https://example.com")).toBe(
      "/planes?plan=04",
    );
    expect(safeDestination("/panel/movimientos")).toBe("/panel/movimientos");
    expect(signInHref("/panel/planes?plan=01")).toBe(
      "/ingresar?next=%2Fpanel%2Fplanes%3Fplan%3D01",
    );
  });
  it("rejects external URLs, backslashes, unrecognized pages and invalid plan values", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\n/evil.example",
      "/admin",
      "/api/profile",
      null,
      ["/panel"],
    ])
      expect(safeDestination(value)).toBe("/panel");
    expect(safeDestination("/panel/planes?plan=01%0a")).toBe("/panel/planes");
    expect(safeDestination("/panel/planes?plan=99")).toBe("/panel/planes");
    expect(safeDestination("/panel/../admin")).toBe("/panel");
  });
});
