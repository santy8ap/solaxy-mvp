"use client";
import { useEffect, useState } from "react";
import { formatKwh, formatNumber } from "@/lib/format";

interface Platform {
  capacityKwp: number;
  soldKw: number;
  availableKw: number;
  investors: number;
  lifetimeKwh: number;
  co2AvoidedKg: number;
}

const CELLS = 100;

/** La planta como 100 celdas de 20 kW: las doradas ya tienen dueño. */
export function Ownership() {
  const [data, setData] = useState<Platform | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/platform")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const sold = data ? data.soldKw / data.capacityKwp : 0;
  const soldCells = Math.round(sold * CELLS);

  return (
    <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8" aria-labelledby="ownership-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <h2 id="ownership-title" className="display text-[clamp(2rem,3.6vw,3rem)] text-silver-50">
            {data ? `${formatNumber(data.soldKw)} de ${formatNumber(data.capacityKwp)} kW ya tienen dueño` : "La planta, celda por celda"}
          </h2>
          <p className="mt-4 max-w-[46ch] text-silver-300">
            Cada celda del mapa equivale a 20 kW de Solaxy Solar I. Cuando compras, tu parte de la energía que se
            vende se convierte en ganancia, todos los días.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-6">
            <div>
              <dt className="text-sm text-silver-400">Inversionistas</dt>
              <dd className="num mt-1 text-2xl font-semibold">{data ? formatNumber(data.investors) : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-silver-400">Energía entregada</dt>
              <dd className="num mt-1 text-2xl font-semibold">{data ? formatKwh(data.lifetimeKwh) : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-silver-400">CO₂ evitado</dt>
              <dd className="num mt-1 text-2xl font-semibold">{data ? `${formatNumber(data.co2AvoidedKg / 1000)} t` : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="panel p-5 sm:p-7">
          <div className="grid grid-cols-10 gap-1.5 sm:gap-2" role="img" aria-label={data ? `${Math.round(sold * 100)} % de la planta vendida` : "Cargando"}>
            {Array.from({ length: CELLS }, (_, i) => {
              const owned = i < soldCells;
              return (
                <span
                  key={i}
                  className="aspect-square rounded-[5px] border transition-colors duration-700"
                  style={{
                    transitionDelay: `${i * 12}ms`,
                    borderColor: owned ? "rgb(246 183 60 / 0.55)" : "rgb(52 72 138 / 0.6)",
                    background: owned
                      ? "linear-gradient(145deg, rgb(255 208 113 / 0.85), rgb(194 132 26 / 0.85))"
                      : "repeating-linear-gradient(90deg, rgb(183 193 218 / 0.08) 0 1px, transparent 1px 6px), rgb(13 25 55 / 0.8)",
                  }}
                />
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between text-sm text-silver-400">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] bg-sun-500" /> Vendido
            </span>
            <span className="num">{data ? `${formatNumber(data.availableKw)} kW disponibles` : ""}</span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] border border-silicon-500 bg-silicon-850" /> Disponible
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
