import { ArrowDownRight, ArrowRight, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { PLANS, PLAN_MONTHS } from "@/config/plans";
import { SOLAR } from "@/config/solar";
import { DAYS_PER_MONTH, GRACE_DAYS } from "@/lib/energy/plan-math";
import { isDemoMode } from "@/lib/env";
import { formatCop, formatHourLabel, formatNumber } from "@/lib/format";
import { MIN_WITHDRAWAL_COP } from "@/lib/withdrawal-schema";
import { AccountLink } from "@/components/auth/account-link";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { CatalogPrice } from "./catalog-price";

export function LandingNav() {
  return (
    <header className="landing-header sticky top-0 z-40 border-b border-line bg-void/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] grid-rows-[68px_auto] items-center gap-x-2 px-4 sm:px-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-rows-[80px] lg:gap-x-6">
        <Link href="/" className="col-start-1 row-start-1 inline-flex items-center justify-self-start" aria-label={`${BRAND.name}, inicio`}>
          <Logo size="header" />
        </Link>
        <div className="col-start-2 row-start-1 flex items-center gap-1.5 sm:gap-2 lg:col-start-3">
          <AccountLink />
          <ThemeSelector />
        </div>
        <nav
          className="landing-nav col-span-2 col-start-1 row-start-2 flex min-h-11 items-stretch justify-between gap-1 whitespace-nowrap border-t border-line text-xs text-fog lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center lg:gap-4 lg:border-0 lg:text-sm xl:gap-7"
          aria-label="Secciones"
        >
          <a href="#reloj" className="hover:text-ink">
            Reloj solar
          </a>
          <a href="#planes" className="hover:text-ink">
            Planes
          </a>
          <a href="#como-funciona" className="hover:text-ink">
            Cómo funciona
          </a>
          <a href="#preguntas" className="hover:text-ink">
            Preguntas
          </a>
          <Link href="/ayuda" className="hover:text-ink">
            Ayuda
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-[1240px] items-center gap-9 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10 lg:pt-[4.5rem] xl:gap-14">
      <div className="min-w-0">
        <h1 className="display landing-headline text-[clamp(3rem,11vw,6rem)] lg:text-[clamp(4.6rem,8.5vw,7.5rem)]">
          <span>Bienvenido</span>{" "}
          <span>al mundo de</span>{" "}
          <span className="landing-headline-accent">la energía</span>
        </h1>
        <div className="landing-intro mt-6 sm:mt-8">
          <p className="max-w-[47ch] leading-relaxed text-fog sm:text-lg">
            Compra energía solar como comercializador, paga mes a mes y consulta
            en tu panel la energía generada y la utilidad de su venta.
          </p>
          <CatalogPrice />
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
            <a href="#planes" className="btn btn-solid landing-hero-action">
              Ver los planes
              <ArrowRight aria-hidden="true" size={16} />
            </a>
            <AccountLink variant="cta" />
          </div>
        </div>
      </div>
      <div className="landing-visual-wrap relative min-w-0">
        <a href="#reloj" className="landing-hero-visual relative isolate flex aspect-[3/2] max-h-[440px] items-end overflow-hidden border border-line-strong bg-raise lg:aspect-[10/9] lg:max-h-none">
          <Image
            src="/solar-field-sunrise.webp"
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1240px) 510px, (min-width: 1024px) 44vw, calc(100vw - 2.5rem)"
            className="landing-hero-photo object-cover object-[60%_center]"
          />
          <span className="landing-visual-link">
            <Sun aria-hidden="true" size={20} strokeWidth={1.5} />
            Ver reloj solar
            <ArrowDownRight aria-hidden="true" size={18} className="ml-auto" />
          </span>
        </a>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Regístrate como comercializador",
    text: "Ingresa a tu cuenta y completa tus datos personales. Te pediremos nombre, documento, celular y ciudad de residencia.",
  },
  {
    title: "Elige un plan y paga el primer mes",
    text: "Al iniciar la compra verás los medios de pago habilitados para el monto de tu plan. El primer periodo comienza al confirmar el pago.",
  },
  {
    title: "Consulta tu energía y tu saldo",
    text: "Desde tu panel puedes seguir la energía que genera tu plan y solicitar un retiro desde el saldo disponible.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="mx-auto max-w-[1240px] px-5 sm:px-8"
    >
      <h2 className="display landing-reveal text-[clamp(3rem,7vw,5.5rem)]">Cómo funciona</h2>
      <ol className="mt-10 grid gap-0 border-t border-line-strong md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="landing-step landing-reveal border-b border-line py-8 md:border-b-0 md:border-l md:py-10 md:pl-8 md:pr-8 md:first:border-l-0 md:first:pl-0"
          >
            <span
              className="figure block text-[4.5rem] text-dim"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="mt-4 text-xl font-medium">{s.title}</h3>
            <p className="mt-3 leading-relaxed text-fog">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SIZES = PLANS.map((p) => formatNumber(p.totalKwh));
const SUNRISE = formatHourLabel(SOLAR.startHour);
const SUNSET = formatHourLabel(SOLAR.endHour);

const FAQ = [
  {
    q: "¿Qué compro como comercializador?",
    a: `Contratas ${SIZES.slice(0, -1).join(", ")} o ${SIZES.at(-1)} kWh de energía solar, según el plan, durante ${PLAN_MONTHS} meses. La energía de cada periodo se calcula día a día con el reloj solar.`,
  },
  {
    q: "¿De dónde sale la utilidad?",
    a: "La utilidad bruta por kWh es la diferencia entre el precio de venta y el precio de compra de tu plan. El porcentaje se calcula sobre el precio de compra, antes de costos e impuestos.",
  },
  {
    q: "¿Cómo se paga?",
    a: `Mes a mes. Cada pago confirmado cubre ${DAYS_PER_MONTH} días de energía. Una mensualidad pagada por adelantado comienza al terminar la anterior. Si queda una mensualidad por pagar al vencer el periodo, la generación se pausa. Puedes pagarla durante los siguientes ${GRACE_DAYS} días, antes de que el plan se cierre.`,
  },
  {
    q: "¿Cuándo puedo retirar?",
    a: `Puedes solicitar un retiro desde ${formatCop(MIN_WITHDRAWAL_COP)} si tienes saldo suficiente en tu panel. Nuestro equipo revisa la solicitud y, si la aprueba, envía el retiro a una cuenta bancaria a tu nombre o en USDT a tu wallet.`,
  },
  {
    q: "¿En qué horario aumenta mi contador?",
    a: `Durante un periodo pagado, el contador suma energía entre las ${SUNRISE} y las ${SUNSET}, hora de Colombia. La curva distribuye la energía contratada a lo largo de ese horario.`,
  },
  {
    q: "¿Qué muestra el reloj solar?",
    a: "La curva muestra la potencia estimada en kW y la energía acumulada estimada en kWh. Puedes explorar el día en intervalos de 15 minutos.",
  },
];

const FAQ_TEST: (typeof FAQ)[number] = {
  q: "¿Cómo hago un pago de prueba?",
  a: "En la compra, elige «Pago de prueba» para simular el pago de una mensualidad. Revisa el medio seleccionado antes de continuar.",
};

export function Faq() {
  const items = isDemoMode() ? [...FAQ, FAQ_TEST] : FAQ;
  return (
    <section
      id="preguntas"
      className="mx-auto max-w-[1240px] px-5 sm:px-8"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <h2 className="display landing-reveal text-[clamp(3rem,7vw,5.5rem)]">Preguntas</h2>
        <div className="border-t border-line-strong">
          {items.map((f) => (
            <details key={f.q} className="landing-faq group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  className="relative h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                >
                  <span className="absolute left-0 top-1/2 h-px w-full bg-ink" />
                  <span className="absolute left-1/2 top-0 h-full w-px bg-ink transition-transform group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[68ch] pb-6 leading-relaxed text-fog">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-8">
      <div className="landing-finale relative isolate overflow-clip border border-line-strong">
        <div className="landing-finale-orbit" aria-hidden="true" />
        <div className="landing-reveal relative flex flex-col gap-8 px-5 py-12 sm:px-10 sm:py-16 md:flex-row md:items-end md:justify-between">
          <h2 className="display max-w-[14ch] text-[clamp(3rem,7vw,5.5rem)]">
            Elige tu plan de energía.
          </h2>
          <div>
            <p className="max-w-[36ch] leading-relaxed text-fog">
              Revisa el precio por kWh y el pago mensual de cada plan.
            </p>
            <a href="#planes" className="btn btn-solid mt-6">
              Ver planes <ArrowRight aria-hidden="true" size={16} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1240px] px-5 pb-12 pt-10 sm:px-8">
      <div className="flex flex-col gap-8 text-sm text-mute md:flex-row md:items-start md:justify-between">
        <div>
          <Logo />
          <p className="mt-5 max-w-[52ch] leading-relaxed">
            La energía de cada plan se calcula con la curva estimada del
            reloj solar.
          </p>
        </div>
        <nav className="flex flex-col gap-2 md:items-end" aria-label="Legal">
          <Link href="/terminos" className="hover:text-ink">
            Términos y Condiciones
          </Link>
          <Link href="/privacidad" className="hover:text-ink">
            Política de Tratamiento de Datos
          </Link>
          <span className="text-dim">Hecho en {BRAND.country}</span>
        </nav>
      </div>
    </footer>
  );
}
