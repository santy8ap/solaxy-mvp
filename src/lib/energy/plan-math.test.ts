import { describe, expect, it } from "vitest";
import { PLANS, PLAN_MONTHS, SALE_COP_PER_KWH } from "@/config/plans";
import { SOLAR } from "@/config/solar";
import {
  GRACE_MS,
  PERIOD_MS,
  energyBetween,
  generatedKwh,
  nextPeriodWindow,
  planEconomics,
  subscriptionState,
  todayKwh,
  userPowerKw,
  type Period,
} from "@/lib/energy/plan-math";
import { DAY_MS, HOUR_MS, bogotaMs } from "@/lib/time";

const at = (d: number, h = 0, m = 0) => bogotaMs(2026, 11, d, h, m);
const period = (index: number, startsAt: number): Period => ({
  index,
  startsAt,
  endsAt: startsAt + PERIOD_MS,
});

describe("planes de energía (notas del cliente)", () => {
  it("desglosa la compra, la venta y la utilidad mensual de los cuatro planes", () => {
    const rows = PLANS.map((plan) => planEconomics(plan, SALE_COP_PER_KWH));
    expect(rows.map((row) => row.monthlyCop)).toEqual([
      76_800_000, 59_400_000, 40_800_000, 20_880_000,
    ]);
    expect(rows.map((row) => row.monthlySaleCop)).toEqual([
      96_000_000, 72_000_000, 48_000_000, 24_000_000,
    ]);
    expect(rows.map((row) => row.monthlyProfitCop)).toEqual([
      19_200_000, 12_600_000, 7_200_000, 3_120_000,
    ]);
    expect(rows.map((row) => row.profitPerKwhCop)).toEqual([80, 70, 60, 52]);
    for (const row of rows)
      expect(row.monthlySaleCop - row.monthlyCop).toBe(row.monthlyProfitCop);
  });

  it("usa los precios recibidos y conserva diferencias negativas sin inventar ganancias", () => {
    const changed = planEconomics(
      { totalKwh: 180_000, priceCopPerKwh: 310 },
      450,
    );
    expect(changed).toMatchObject({
      monthlyCop: 18_600_000,
      monthlySaleCop: 27_000_000,
      monthlyProfitCop: 8_400_000,
    });
    const loss = planEconomics({ totalKwh: 180_000, priceCopPerKwh: 410 }, 400);
    expect(loss.monthlyProfitCop).toBe(-600_000);
  });
  it("son cuatro planes de 3 meses y toda la energía se vende a $ 400", () => {
    expect(SALE_COP_PER_KWH).toBe(400);
    expect(PLAN_MONTHS).toBe(3);
    expect(PLANS.map((p) => [p.totalKwh, p.priceCopPerKwh])).toEqual([
      [720_000, 320],
      [540_000, 330],
      [360_000, 340],
      [180_000, 348],
    ]);
  });

  it("energía promedio: día, mes y 3 meses", () => {
    const rows = PLANS.map((p) => planEconomics(p, SALE_COP_PER_KWH));
    expect(rows.map((r) => r.dailyKwh)).toEqual([8000, 6000, 4000, 2000]);
    expect(rows.map((r) => r.monthlyKwh)).toEqual([
      240_000, 180_000, 120_000, 60_000,
    ]);
  });

  it("la utilidad sobre el precio del plan es 25 %, 21 %, 18 % y 15 %", () => {
    const pct = PLANS.map((p) =>
      Math.round(planEconomics(p, SALE_COP_PER_KWH).profitPct * 100),
    );
    expect(pct).toEqual([25, 21, 18, 15]);
  });

  it("pago mensual y rendimiento diario en pesos", () => {
    const top = planEconomics(PLANS[0], SALE_COP_PER_KWH);
    expect(top.monthlyCop).toBe(76_800_000);
    expect(top.totalCop).toBe(230_400_000);
    expect(top.dailySaleCop).toBe(3_200_000);
    expect(top.dailyProfitCop).toBe(640_000);
    expect(top.totalProfitCop).toBe(57_600_000);
    expect(planEconomics(PLANS[3], SALE_COP_PER_KWH).monthlyCop).toBe(
      20_880_000,
    );
  });
});

describe("energía generada por un plan", () => {
  it("un día completo entrega exactamente los kWh diarios, empiece a la hora que empiece", () => {
    for (const start of [at(10, 0), at(10, 9, 41), at(10, 14, 5), at(10, 22)]) {
      expect(energyBetween(SOLAR, 8000, start, start + DAY_MS)).toBeCloseTo(
        8000,
        6,
      );
    }
  });

  it("de noche no se genera y a mediodía solar va la mitad del día", () => {
    expect(energyBetween(SOLAR, 8000, at(10, 19), at(11, 6))).toBe(0);
    expect(energyBetween(SOLAR, 8000, at(10, 0), at(10, 12, 30))).toBeCloseTo(
      4000,
      6,
    );
    expect(energyBetween(SOLAR, 8000, at(10, 12), at(10, 11))).toBe(0);
  });

  it("un periodo de 30 días entrega un tercio del plan y nunca más", () => {
    const p = period(1, at(10, 15, 20));
    expect(generatedKwh(SOLAR, 8000, [p], p.endsAt)).toBeCloseTo(240_000, 5);
    expect(generatedKwh(SOLAR, 8000, [p], p.endsAt + 40 * DAY_MS)).toBeCloseTo(
      240_000,
      5,
    );
    expect(generatedKwh(SOLAR, 8000, [p], p.startsAt - HOUR_MS)).toBe(0);
  });

  it("tres periodos seguidos entregan el plan completo; en una pausa no se genera", () => {
    const p1 = period(1, at(10, 9));
    const p2 = period(2, p1.endsAt);
    const late = period(3, p2.endsAt + 5 * DAY_MS);
    expect(generatedKwh(SOLAR, 8000, [p1, p2, late], late.endsAt)).toBeCloseTo(
      720_000,
      4,
    );
    // Durante la pausa (entre el periodo 2 y el 3) el total no cambia.
    expect(
      generatedKwh(SOLAR, 8000, [p1, p2, late], p2.endsAt + 3 * DAY_MS),
    ).toBeCloseTo(480_000, 4);
  });

  it("la energía de hoy cuenta desde la medianoche y solo dentro de un periodo pagado", () => {
    const p = period(1, at(10, 12, 30));
    expect(todayKwh(SOLAR, 8000, [p], at(10, 19))).toBeCloseTo(4000, 6);
    expect(todayKwh(SOLAR, 8000, [p], at(11, 12, 30))).toBeCloseTo(4000, 6);
    expect(todayKwh(SOLAR, 8000, [p], at(11, 23))).toBeCloseTo(8000, 6);
    expect(todayKwh(SOLAR, 8000, [], at(11, 12))).toBe(0);
  });

  it("la potencia del usuario sigue la campana y su área diaria son sus kWh", () => {
    const p = period(1, at(1));
    expect(userPowerKw(SOLAR, 8000, [p], at(10, 3))).toBe(0);
    expect(userPowerKw(SOLAR, 8000, [p], at(10, 12, 30))).toBeCloseTo(
      (8000 * Math.PI) / (2 * 13),
      6,
    );
    expect(userPowerKw(SOLAR, 8000, [], at(10, 12, 30))).toBe(0);
    let kwh = 0;
    for (let m = 0; m < 24 * 60; m++)
      kwh += userPowerKw(SOLAR, 8000, [p], at(10) + (m + 0.5) * 60_000) / 60;
    expect(kwh).toBeCloseTo(8000, 0);
  });
});

describe("estado de un plan según sus periodos", () => {
  const sub = { months: 3, cancelledAt: null };
  const p1 = period(1, at(1, 8));

  it("sin periodos es un borrador", () => {
    expect(subscriptionState(sub, [], at(1))).toBe("borrador");
  });

  it("activa mientras corre un periodo pagado", () => {
    expect(subscriptionState(sub, [p1], p1.startsAt)).toBe("activa");
    expect(subscriptionState(sub, [p1], p1.endsAt - 1)).toBe("activa");
  });

  it("en pausa al terminar el periodo si faltan meses por pagar; vencida tras 15 días", () => {
    expect(subscriptionState(sub, [p1], p1.endsAt)).toBe("en_pausa");
    expect(subscriptionState(sub, [p1], p1.endsAt + GRACE_MS)).toBe("en_pausa");
    expect(subscriptionState(sub, [p1], p1.endsAt + GRACE_MS + 1)).toBe(
      "vencida",
    );
  });

  it("completada cuando terminan los 3 meses pagados", () => {
    const p2 = period(2, p1.endsAt);
    const p3 = period(3, p2.endsAt);
    expect(subscriptionState(sub, [p1, p2, p3], p3.endsAt - 1)).toBe("activa");
    expect(subscriptionState(sub, [p1, p2, p3], p3.endsAt)).toBe("completada");
  });

  it("cancelada si el admin la cerró", () => {
    expect(
      subscriptionState({ months: 3, cancelledAt: at(5) }, [p1], at(6)),
    ).toBe("cancelada");
  });

  it("una devolución no muestra generación en el intervalo anterior a otro mes ya pagado", () => {
    const cut = at(5, 12);
    const p2 = period(2, p1.endsAt);
    const periods = [{ ...p1, endsAt: cut }, p2];
    expect(subscriptionState(sub, periods, at(10, 12))).toBe("en_pausa");
    expect(userPowerKw(SOLAR, 2000, periods, at(10, 12))).toBe(0);
    expect(subscriptionState(sub, periods, p2.startsAt)).toBe("activa");
    expect(nextPeriodWindow(periods, at(10)).startsAt).toBe(p2.endsAt);
  });
});

describe("cuándo empieza el siguiente periodo", () => {
  it("el primero empieza al confirmarse el pago", () => {
    expect(nextPeriodWindow([], at(10, 9))).toEqual({
      index: 1,
      startsAt: at(10, 9),
      endsAt: at(10, 9) + PERIOD_MS,
    });
  });

  it("si se paga antes, empieza al terminar el anterior; si se paga tarde, al confirmarse", () => {
    const p1 = period(1, at(1, 8));
    expect(nextPeriodWindow([p1], p1.endsAt - 3 * DAY_MS)).toEqual({
      index: 2,
      startsAt: p1.endsAt,
      endsAt: p1.endsAt + PERIOD_MS,
    });
    const late = p1.endsAt + 4 * DAY_MS;
    expect(nextPeriodWindow([p1], late)).toEqual({
      index: 2,
      startsAt: late,
      endsAt: late + PERIOD_MS,
    });
  });
});
