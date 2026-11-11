"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { SunArc } from "./sun-arc";
import { ENERGY_PLANS, type EnergyPlan } from "@/config/energy-plans";
import { PlanCards } from "@/components/plans/plan-cards";
import { EclipseScene, EnergyIntro } from "./eclipse-scene";
import { useHomeMotion } from "./use-home-motion";
import "./eclipse-motion.css";

const number = new Intl.NumberFormat("es-CO");
const cop = (value: number) => `$ ${number.format(value)}`;
const plans = ENERGY_PLANS;
const questions = [
  [
    "¿Cómo están estructurados los planes?",
    "Cada plan contempla tres meses de energía, con pago mensual. La tabla utiliza periodos de 30 días y muestra tanto el volumen mensual como el total de los 90 días.",
  ],
  [
    "¿Qué diferencia hay entre kW y kWh?",
    "Los kW expresan potencia: cuánta energía puede producirse en un instante. Los kWh expresan una cantidad de energía a lo largo del tiempo. Los planes se expresan en kWh; el reloj solar, en kW.",
  ],
  [
    "¿Qué significa el porcentaje de utilidad?",
    "Es la diferencia entre el valor de venta de referencia de $400 por kWh y el precio del plan, dividida entre el precio del plan. Es una utilidad bruta de referencia, antes de costos e impuestos; no es un descuento ni una rentabilidad garantizada.",
  ],
  [
    "¿El reloj muestra producción real?",
    "Por ahora muestra el ciclo solar proyectado entre las 6 a. m. y las 7 p. m., en hora de Colombia. Su máximo de referencia es 8.000 kW. Los datos medidos se incorporarán al conectar los medidores de la planta.",
  ],
];

export function EclipseHome() {
  const root = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<EnergyPlan>(plans[3]);
  const [now, setNow] = useState<number | null>(null);
  const [animationsPaused, setAnimationsPaused] = useState(false);
  useHomeMotion(root, animationsPaused);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const monthly = plan.daily * 30;
  const time =
    now === null
      ? "— — : — — : — —"
      : new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(now);
  return (
    <div className="eclipse-home" ref={root} data-motion={animationsPaused ? "paused" : "ready"}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader
        landing
        mobileActions={
          <button
            type="button"
            className="mobile-motion-toggle"
            aria-pressed={animationsPaused}
            onClick={() => setAnimationsPaused((value) => !value)}
          >
            {animationsPaused ? <Play size={14} /> : <Pause size={14} />}
            {animationsPaused ? "Activar animaciones" : "Pausar animaciones"}
          </button>
        }
      >
        <button
          type="button"
          className="motion-toggle"
          onClick={() => setAnimationsPaused((value) => !value)}
          aria-label={animationsPaused ? "Activar animaciones" : "Pausar animaciones"}
          aria-pressed={animationsPaused}
          title={animationsPaused ? "Activar animaciones" : "Pausar animaciones"}
        >
          {animationsPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <Link href="/panel" prefetch={false} className="btn btn-ghost">
          Mi cuenta <ArrowUpRight size={15} />
        </Link>
      </SiteHeader>
      <main id="contenido">
        <section
          className="eclipse-wrap eclipse-hero"
          data-in-view="true"
          aria-labelledby="hero-title"
        >
          <div className="eyebrow hero-eyebrow">
            <span>ENERGÍA SOLAR PARA EMPRESAS</span>
            <span>COLOMBIA · 06° N / 75° O</span>
          </div>
          <div className="hero-layout">
            <EclipseScene />
            <h1 id="hero-title" aria-label="El futuro tiene energía.">
              <span className="hero-title-mask"><span className="hero-title-line">EL FUTURO</span></span>
              <span className="hero-title-mask"><span className="hero-title-line">TIENE</span></span>
              <span className="hero-title-mask"><span className="hero-title-line hero-title-energy">ENERGÍA.</span></span>
            </h1>
            <div className="hero-aside">
              <span className="eyebrow">IN WORLD ENERGY / 01</span>
              <p>
                Una nueva forma de conectar tu empresa con la energía del sol.
              </p>
              <p className="muted">
                Planes de energía. Precios claros. Una visión de largo plazo.
              </p>
              <a className="btn btn-sun" href="#planes">
                Explorar los planes <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
          <div className="hero-baseline">
            <span>EL SOL MARCA EL RITMO. TÚ ELIGES EL PLAN.</span>
            <a href="#planta" aria-label="Explorar el ciclo solar" className="hero-scroll-cue">
              <span>EXPLORAR</span>
              <ArrowDown size={19} />
            </a>
          </div>
        </section>
        <EnergyIntro />
        <section
          id="planta"
          className="eclipse-wrap eclipse-section clock-section"
          aria-labelledby="clock-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / EL CICLO DE LA ENERGÍA</span>
              <h2 id="clock-title">CADA HORA CUENTA.</h2>
            </div>
            <div className="clock-time">
              <span className="eyebrow">
                <span className="live-dot" /> HORA DE COLOMBIA
              </span>
              <span className="mono">{time}</span>
            </div>
          </div>
          <SunArc now={now} reading={null} />
          <div className="clock-footer">
            <p>La trayectoria del sol, de principio a fin.</p>
            <p className="muted">
              Proyección de referencia · Sin conexión a medidores
            </p>
          </div>
        </section>
        <section
          id="planes"
          className="eclipse-wrap eclipse-section"
          aria-labelledby="plans-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / ENCUENTRA TU ESCALA</span>
              <h2 id="plans-title">
                TU ENERGÍA.
                <br />
                TU PLAN.
              </h2>
            </div>
            <p className="section-intro">
              Haz clic en un plan para empezar.
              <br />
              Un contrato de 3 meses, con pago mensual.
              <br />
              <span className="muted">
                Todos los valores en pesos colombianos.
              </span>
            </p>
          </div>
          <PlanCards selected={plan} onPreview={setPlan} />
          <div className="plan-detail" aria-live="polite">
            <div>
              <span className="eyebrow">
                PLAN {plan.name.toUpperCase()} / PAGO MENSUAL
              </span>
              <p key={plan.id} className="plan-total mono">
                {cop(monthly * plan.price)} <span>COP</span>
              </p>
              <p className="muted">{number.format(monthly)} kWh cada 30 días</p>
            </div>
            <div className="plan-detail-note">
              <p>Tu siguiente paso, con todo claro.</p>
              <p className="muted">
                Consulta el resumen de tu plan y completa los datos de tu empresa
                en la vista de compra.
              </p>
              <Link className="btn btn-sun" href={`/comprar/${plan.id}`} prefetch={false}>
                Comprar plan {plan.name} <ArrowUpRight size={16} />
              </Link>
              <a className="text-link" href="#comparar">
                Ver comparación completa <ArrowDown size={16} />
              </a>
            </div>
          </div>
          <div
            id="comparar"
            className="comparison"
            role="region"
            aria-label="Comparación de planes de energía"
            tabIndex={0}
          >
            <table>
              <caption>PRECIOS Y UTILIDAD DE REFERENCIA</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Energía mensual</th>
                  <th scope="col">Precio / kWh</th>
                  <th scope="col">Pago mensual</th>
                  <th scope="col">Utilidad bruta*</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} data-selected={p.id === plan.id}>
                    <th scope="row">{p.name}</th>
                    <td>{number.format(p.daily * 30)} kWh</td>
                    <td>{cop(p.price)}</td>
                    <td>{cop(p.daily * 30 * p.price)}</td>
                    <td>
                      {new Intl.NumberFormat("es-CO", {
                        maximumFractionDigits: 2,
                      }).format(((400 - p.price) / p.price) * 100)}{" "}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">
            * Calculada sobre el precio de compra, con venta de referencia a
            $400/kWh. Antes de costos e impuestos. No constituye una garantía de
            rendimiento.
          </p>
        </section>
        <section
          id="como-funciona"
          className="eclipse-wrap eclipse-section"
          aria-labelledby="steps-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">03 / UN PROCESO CLARO</span>
              <h2 id="steps-title">
                MENOS COMPLEJIDAD.
                <br />
                MÁS PERSPECTIVA.
              </h2>
            </div>
            <p className="section-intro muted">
              Así se estructura la contratación
              <br />
              de energía para tu empresa.
            </p>
          </div>
          <ol className="steps-grid">
            {[
              [
                "Elige tu escala",
                "Compara el volumen de energía, el precio por kWh y el valor mensual de cada plan.",
              ],
              [
                "Identifica tu empresa",
                "La contratación requiere razón social, NIT y los datos del representante legal.",
              ],
              [
                "Sigue tu energía",
                "Consulta la energía y los rendimientos una vez que se active el contrato y su liquidación.",
              ],
            ].map(([title, desc], i) => (
              <li key={title}>
                <span className="eyebrow">0{i + 1} /</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="eclipse-wrap eclipse-section faq-section"
          aria-labelledby="faq-title"
        >
          <div>
            <span className="eyebrow">04 / SIN LETRA PEQUEÑA</span>
            <h2 id="faq-title">
              HABLEMOS
              <br />
              CON CLARIDAD.
            </h2>
          </div>
          <div>
            {questions.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="eclipse-wrap closing">
          <span className="eyebrow">LA ENERGÍA NOS MUEVE.</span>
          <div>
            <h2>
              EL SIGUIENTE
              <br />
              PASO ES TUYO.
            </h2>
            <a href="#planes" className="btn btn-sun">
              Comparar planes <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
