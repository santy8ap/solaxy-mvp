import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENERGY_PLANS } from "@/config/energy-plans";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`REDIRECT ${destination}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

import { requirePlanBuyer } from "./plan-purchase-access";

beforeEach(() => {
  mocks.getSessionUser.mockReset();
  mocks.redirect.mockClear();
  mocks.notFound.mockClear();
});

describe("energy plan purchase access", () => {
  it.each(ENERGY_PLANS)("sends a guest back to $name after login", async (plan) => {
    mocks.getSessionUser.mockResolvedValue(null);
    const destination = `/ingresar?next=%2Fcomprar%2F${plan.id}`;
    await expect(requirePlanBuyer(plan.id)).rejects.toThrow(`REDIRECT ${destination}`);
    expect(mocks.redirect).toHaveBeenCalledWith(destination);
  });

  it.each(ENERGY_PLANS)("lets a signed-in buyer open $name directly", async (plan) => {
    const user = { id: "buyer-1", name: "Empresa", email: "buyer@example.com", image: null };
    mocks.getSessionUser.mockResolvedValue(user);
    await expect(requirePlanBuyer(plan.id)).resolves.toEqual({ plan, user });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects unknown plans before checking the session", async () => {
    await expect(requirePlanBuyer("99")).rejects.toThrow("NOT_FOUND");
    expect(mocks.getSessionUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not grant purchase access when session validation fails", async () => {
    mocks.getSessionUser.mockRejectedValue(new Error("Session unavailable"));
    await expect(requirePlanBuyer("01")).rejects.toThrow("Session unavailable");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
