import { describe, expect, it } from "vitest";
import { PLANT } from "@/config/plant";
import { bogotaMs, localHour } from "@/lib/sim";
import { sunDay, sunElevation } from "@/lib/sim/sun-times";

describe("horario del sol en la planta", () => {
  const nov4 = bogotaMs(2026, 11, 4, 12);

  it("amanece entre 5:30 y 6:15 y atardece entre 17:30 y 18:15", () => {
    const d = sunDay(PLANT, nov4);
    expect(localHour(d.sunrise)).toBeGreaterThan(5.5);
    expect(localHour(d.sunrise)).toBeLessThan(6.25);
    expect(localHour(d.sunset)).toBeGreaterThan(17.5);
    expect(localHour(d.sunset)).toBeLessThan(18.25);
  });

  it("la elevación máxima en noviembre ronda los 68°", () => {
    expect(sunDay(PLANT, nov4).maxElevation).toBeGreaterThan(64);
    expect(sunDay(PLANT, nov4).maxElevation).toBeLessThan(72);
  });

  it("a las 7 pm el sol está bajo el horizonte", () => {
    expect(sunElevation(PLANT, bogotaMs(2026, 11, 4, 19))).toBeLessThan(0);
  });
});
