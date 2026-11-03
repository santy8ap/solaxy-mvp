"use client";
import { useMemo, useState } from "react";
import { ECONOMICS } from "@/config/economics";
import { PLANT } from "@/config/plant";
import { formatCop, formatCopCompact, formatNumber, formatPct } from "@/lib/format";
import { dayProfile, localDayIndex } from "@/lib/sim";

/** Días de referencia: 120 días hasta el 1.º de noviembre de 2026 (determinista). */
const REFERENCE_LAST_DAY = localDayIndex(Date.UTC(2026, 10, 1, 17));

/** Ingreso neto anual por kWp según 120 días del modelo de la planta. */
function useYearlyNetPerKwp() {
  return useMemo(() => {
    let net = 0;
    for (let d = 0; d < 120; d++) net += dayProfile(PLANT, REFERENCE_LAST_DAY - d).reduce((s, i) => s + i.netCop, 0);
    return ((net / 120) * 365) / PLANT.capacityKwp;
  }, []);
}

export function Simulator() {
  const [kw, setKw] = useState(2);
  const perKwp = useYearlyNetPerKwp();
  const invest = kw * ECONOMICS.pricePerKwCop;
  const yearly = kw * perKwp;
  const years = [1, 2, 3, 4, 5].map((y) => ({ y, total: yearly * y }));
  const max = years.at(-1)!.total;
  const yieldEa = perKwp / ECONOMICS.pricePerKwCop;

  return (
    <section id="simulador" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8" aria-labelledby="sim-title">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h2 id="sim-title" className="display text-[clamp(2rem,3.6vw,3rem)] text-silver-50">
            ¿Cuánto ganarías?
          </h2>
          <p className="mt-4 max-w-[44ch] text-silver-300">
            El cálculo usa la producción del modelo de la planta en 120 días recientes: unos{" "}
            <span className="num text-silver-100">{formatPct(yieldEa)}</span> efectivo anual. Es una estimación, no una
            promesa.
          </p>
          <div className="mt-10">
            <label htmlFor="sim-kw" className="flex items-baseline justify-between text-silver-300">
              <span>Quiero comprar</span>
              <span className="num display text-3xl text-sun-300">{formatNumber(kw, 1)} kW</span>
            </label>
            <input
              id="sim-kw"
              type="range"
              min={0.1}
              max={25}
              step={0.1}
              value={kw}
              onChange={(e) => setKw(Number(e.target.value))}
              className="mt-4 w-full"
            />
            <div className="mt-2 flex justify-between text-sm text-silver-400">
              <span>0,1 kW</span>
              <span>25 kW</span>
            </div>
            <p className="mt-6 text-silver-300">
              Inversión: <span className="num font-semibold text-silver-50">{formatCop(invest)}</span>
            </p>
          </div>
        </div>

        <div className="panel p-6 sm:p-8">
          <dl className="grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-silver-400">Al mes, aprox.</dt>
              <dd className="num mt-1 text-2xl font-semibold text-leaf-300">{formatCop(yearly / 12)}</dd>
            </div>
            <div>
              <dt className="text-sm text-silver-400">Al año, aprox.</dt>
              <dd className="num mt-1 text-2xl font-semibold text-silver-50">{formatCop(yearly)}</dd>
            </div>
            <div>
              <dt className="text-sm text-silver-400">Recuperas la inversión en</dt>
              <dd className="num mt-1 text-2xl font-semibold text-silver-50">{formatNumber(ECONOMICS.pricePerKwCop / perKwp, 1)} años</dd>
            </div>
          </dl>
          <div className="mt-8">
            <p className="text-sm text-silver-400">Ganancias acumuladas sin reinvertir</p>
            <div className="mt-4 flex h-52 items-end gap-3" role="img" aria-label={`En 5 años ganarías cerca de ${formatCop(max)}`}>
              {years.map(({ y, total }) => (
                <div key={y} className="group flex h-full flex-1 flex-col justify-end">
                  <span className="num mb-2 text-center text-xs text-silver-300 opacity-70 transition-opacity group-hover:opacity-100">
                    {formatCopCompact(total)}
                  </span>
                  <div
                    className="rounded-t-[4px] transition-[height] duration-500 ease-out"
                    style={{ height: `${(total / max) * 80}%`, background: "linear-gradient(180deg, #2aa06e, rgb(42 160 110 / 0.35))" }}
                  />
                  <span className="mt-2 text-center text-sm text-silver-400">Año {y}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
