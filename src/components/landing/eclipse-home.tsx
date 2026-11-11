"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Check, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SunArc } from "./sun-arc";
import { ENERGY_PLANS } from "@/config/energy-plans";

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
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState(3);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [menu]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || !("IntersectionObserver" in window)) return;
    const elements = root.current?.querySelectorAll(
      ".section-heading, .plan-grid, .plan-detail, .steps-grid li, .faq-section, .closing",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    elements?.forEach((element) => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add("reveal-on-scroll");
        observer.observe(element);
      }
    });
    const showAll = () =>
      elements?.forEach((element) => element.classList.add("is-revealed"));
    motion.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", showAll);
    };
  }, []);
  const plan = plans[selected];
  const monthly = plan.daily * 30;
  const links = [
    ["#planta", "Ciclo solar"],
    ["#planes", "Planes de energía"],
    ["#como-funciona", "Cómo funciona"],
    ["/planta", "La planta"],
    ["/ayuda", "Ayuda"],
  ];
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
    <div className="eclipse-home" ref={root}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="eclipse-header">
        <nav className="eclipse-wrap eclipse-navigation" aria-label="Principal">
          <Link href="/" aria-label="In World Energy, inicio">
            <Logo />
          </Link>
          <div className="desktop-links">
            {links.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            <Link href="/ingresar" className="btn btn-ghost">
              Ingresar <ArrowUpRight size={15} />
            </Link>
            <button
              className="menu-toggle"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              aria-controls="mobile-navigation"
              aria-label={menu ? "Cerrar menú" : "Abrir menú"}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
        {menu && (
          <nav
            id="mobile-navigation"
            className="mobile-links"
            aria-label="Navegación móvil"
          >
            {links.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>
                {label}
                <ArrowUpRight size={16} />
              </a>
            ))}
          </nav>
        )}
      </header>
      <main id="contenido">
        <section
          className="eclipse-wrap eclipse-hero"
          aria-labelledby="hero-title"
        >
          <div className="eyebrow hero-eyebrow">
            <span>ENERGÍA SOLAR PARA EMPRESAS</span>
            <span>COLOMBIA · 06° N / 75° O</span>
          </div>
          <div className="hero-layout">
            <div className="hero-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1 id="hero-title">
              EL FUTURO
              <br />
              TIENE <span>ENERGÍA.</span>
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
            <a href="#planta" aria-label="Explorar el ciclo solar">
              <ArrowDown size={19} />
            </a>
          </div>
        </section>
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
              Cuatro formas de empezar.
              <br />
              Un contrato de 3 meses, con pago mensual.
              <br />
              <span className="muted">
                Todos los valores en pesos colombianos.
              </span>
            </p>
          </div>
          <fieldset className="plan-grid">
            <legend className="sr-only">
              Selecciona un plan para consultar sus valores
            </legend>
            {plans.map((p, i) => (
              <label
                className={`plan-card ${i === selected ? "selected" : ""}`}
                key={p.id}
              >
                <input
                  type="radio"
                  name="energy-plan"
                  checked={i === selected}
                  onChange={() => setSelected(i)}
                />
                <span className="plan-top eyebrow">
                  {p.name}
                  <span>{i === selected ? <Check size={16} /> : p.id}</span>
                </span>
                <span className="plan-volume">
                  {number.format(p.daily)} <span>kWh</span>
                </span>
                <span className="plan-period">
                  energía diaria de referencia
                </span>
                <span className="plan-price mono">
                  {cop(p.price)} <span>/ kWh</span>
                </span>
                <span className="plan-bottom">
                  {number.format(p.daily * 90)} kWh / 3 meses{" "}
                  <ArrowUpRight size={16} />
                </span>
              </label>
            ))}
          </fieldset>
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
              <p>Compara antes de decidir.</p>
              <p className="muted">
                El catálogo de planes está definido. Su contratación mensual aún
                no está habilitada en esta versión.
              </p>
              <Link className="text-link" href={`/planes?plan=${plan.id}`}>
                  Revisar plan {plan.name} <ArrowUpRight size={16} />
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
      <footer className="eclipse-footer eclipse-wrap">
        <div>
          <Logo />
          <p>Energía solar. Visión empresarial.</p>
        </div>
        <div>
          <Link href="/ayuda">Centro de ayuda ↗</Link>
          <Link href="/planta">Conoce la planta ↗</Link>
          <Link href="/terminos">Términos y condiciones ↗</Link>
          <Link href="/privacidad">Política de privacidad ↗</Link>
        </div>
        <span className="eyebrow">
          IN WORLD ENERGY
          <br />
          HECHO EN COLOMBIA
        </span>
      </footer>
    </div>
  );
}
