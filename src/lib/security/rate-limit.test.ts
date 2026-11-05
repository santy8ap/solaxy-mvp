import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/security/rate-limit";

describe("límite de solicitudes", () => {
  it("permite hasta el máximo dentro de la ventana y luego bloquea", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect([rl.hit("u", t), rl.hit("u", t + 1), rl.hit("u", t + 2)]).toEqual([true, true, true]);
    expect(rl.hit("u", t + 3)).toBe(false);
    expect(rl.hit("otro", t + 3)).toBe(true);
    expect(rl.hit("u", t + 60_001)).toBe(true);
  });
});
