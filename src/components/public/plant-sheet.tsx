"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useSettings } from "@/lib/client/use-settings";
import { formatNumber } from "@/lib/format";

const views = [
  {
    name: "Captación",
    title: "La energía empieza con la luz.",
    description:
      "Los módulos fotovoltaicos convierten la luz solar en energía eléctrica.",
  },
  {
    name: "Conversión",
    title: "Una transformación esencial.",
    description:
      "Los inversores convierten la corriente continua de los módulos en corriente alterna.",
  },
  {
    name: "Almacenamiento",
    title: "Energía que puede esperar.",
    description:
      "El almacenamiento permite conservar parte de la energía para su entrega posterior.",
  },
] as const;
function PlantIllustration({ view }: { view: number }) {
  return (
    <svg
      viewBox="0 0 1000 410"
      role="img"
      aria-label={`Esquema ilustrativo: ${views[view].name.toLowerCase()}`}
    >
      <g stroke="#262626" strokeWidth="1">
        {Array.from({ length: 20 }, (_, i) => (
          <line key={i} x1={i * 56} x2={i * 56 - 200} y1="0" y2="410" />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1="0" x2="1000" y1={i * 52} y2={i * 52} />
        ))}
      </g>
      {view === 0 ? (
        <g>
          {Array.from({ length: 18 }, (_, i) => {
            const row = Math.floor(i / 6),
              col = i % 6;
            const x = 110 + col * 120 - row * 22,
              y = 100 + row * 75;
            return (
              <g key={i}>
                <path
                  d={`M${x + 22} ${y}h100l-22 56H${x}Z`}
                  fill={i % 4 === 0 ? "#bdbdbd" : "#171717"}
                  stroke="#bdbdbd"
                />
                <path
                  d={`M${x + 12} ${y + 28}h100M${x + 54} ${y}l-22 56M${x + 88} ${y}l-22 56`}
                  stroke={i % 4 === 0 ? "#555" : "#777"}
                  strokeWidth=".6"
                />
              </g>
            );
          })}
          <circle cx="830" cy="66" r="24" fill="#eee" />
          <circle cx="830" cy="66" r="38" fill="none" stroke="#666" />
        </g>
      ) : view === 1 ? (
        <g stroke="#ccc" fill="none">
          <path d="M100 205h210m380 0h210" strokeDasharray="6 8" />
          <rect x="310" y="80" width="380" height="250" fill="#101010" />
          <path d="M350 120h110m-110 14h110" />
          <path d="M540 135q25-50 50 0t50 0" />
          <path d="M350 250l280-100" stroke="#555" />
          <text
            x="500"
            y="292"
            textAnchor="middle"
            fill="#ddd"
            stroke="none"
            fontSize="18"
            letterSpacing="6"
          >
            INVERSOR
          </text>
          <circle cx="100" cy="205" r="8" fill="#ddd" />
          <circle cx="900" cy="205" r="8" fill="#ddd" />
        </g>
      ) : (
        <g stroke="#ccc" fill="none">
          <rect x="250" y="90" width="480" height="230" fill="#101010" />
          <path d="M730 165h30v80h-30" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={275 + i * 87}
              y="115"
              width="65"
              height="180"
              fill={i < 3 ? "#bbb" : "#222"}
              stroke="none"
            />
          ))}
          <path d="M140 205h100m530 0h100" strokeDasharray="5 8" />
        </g>
      )}
      <text x="48" y="382" fill="#999" fontSize="12" letterSpacing="3">
        IN WORLD ENERGY / ESQUEMA ILUSTRATIVO
      </text>
    </svg>
  );
}
export function PlantSheet() {
  const { spec, loaded } = useSettings();
  const [view, setView] = useState(0);
  return (
    <>
      <div className="resource-hero">
        <span className="eyebrow">IN WORLD ENERGY / LA PLANTA</span>
        <h1>
          CONOCE EL ORIGEN
          <br />
          DE TU ENERGÍA.
        </h1>
        <p>
          Una mirada a los componentes del sistema y a su información
          registrada.
        </p>
      </div>
      <section className="plant-gallery" aria-label="Componentes de la planta">
        <div
          className="chart-periods"
          role="group"
          aria-label="Explorar los componentes"
        >
          {views.map((item, index) => (
            <button
              type="button"
              key={item.name}
              aria-pressed={view === index}
              onClick={() => setView(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <PlantIllustration view={view} />
        <div className="plant-gallery-caption">
          <h2>{views[view].title}</h2>
          <p>{views[view].description}</p>
        </div>
        <p className="table-note">
          Estos esquemas son ilustrativos. Las fotografías oficiales de la
          planta todavía no están disponibles.
        </p>
      </section>
      <section className="plant-fact-sheet" aria-labelledby="plant-sheet-title">
        <div className="account-section-heading">
          <div>
            <span className="eyebrow">
              {loaded ? "INFORMACIÓN REGISTRADA" : "FICHA DE REFERENCIA"}
            </span>
            <h2 id="plant-sheet-title">El sistema, en cifras.</h2>
          </div>
          <MapPin size={20} />
        </div>
        <p className="plant-location">{spec.location}</p>
        <dl>
          {[
            ["Potencia instalada", `${formatNumber(spec.capacityKwp)} kWp`],
            ["Potencia AC registrada", `${formatNumber(spec.acCapacityKw)} kW`],
            ["Módulos solares", formatNumber(spec.moduleCount)],
            ["Potencia por módulo", `${formatNumber(spec.moduleWatt)} W`],
            ["Inversores", formatNumber(spec.inverterCount)],
            ["Almacenamiento", `${formatNumber(spec.battery.capacityKwh)} kWh`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="table-note">
          La ficha presenta la configuración registrada del sistema. No
          certifica una medición de producción. El reloj solar es una proyección
          visual independiente con máximo de 8.000 kW.
        </p>
      </section>
      <div className="help-links">
        <Link href="/planes" className="btn btn-sun">
          Explorar planes <ArrowUpRight size={15} />
        </Link>
        <Link href="/ayuda" className="btn btn-ghost">
          Entender la energía <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
}
