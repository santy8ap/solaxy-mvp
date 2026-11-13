import { ArrowDownRight, ArrowRight, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { PLANS, PLAN_MONTHS } from "@/config/plans";
import { SOLAR } from "@/config/solar";
import { DAYS_PER_MONTH, GRACE_DAYS } from "@/lib/energy/plan-math";
import { isDemoMode } from "@/lib/env";
import { formatCop, formatHourLabel, formatNumber } from "@/lib/format";
import { DEFAULT_MP_LIMITS } from "@/lib/payments/mercadopago-limits";
import { MIN_WITHDRAWAL_COP } from "@/lib/withdrawal-schema";
import { AccountLink } from "@/components/auth/account-link";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { CatalogValue } from "./catalog-value";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void/90 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-2 px-4 sm:h-20 sm:gap-4 sm:px-8 lg:gap-6">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label={`${BRAND.name}, inicio`}>
          <Logo size="header" />
        </Link>
        <nav
          className="landing-nav hidden items-center gap-3 whitespace-nowrap text-xs text-fog md:flex lg:gap-5 lg:text-sm xl:gap-7"
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
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <AccountLink />
          <ThemeSelector />
        </div>
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
            Como comercializador compras energía a precio de plan, desde{" "}
            <CatalogValue pick="lowestPrice" /> el kWh. La planta la genera cada
            día y se vende a <CatalogValue pick="sale" />. La diferencia es tu
            utilidad, y la ves crecer mientras sale el sol.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
            <a href="#planes" className="btn btn-solid landing-hero-action">
              Ver los planes
              <ArrowRight aria-hidden="true" size={16} />
            </a>
            <AccountLink variant="cta" />
          </div>
        </div>
      </div>
      <a href="#reloj" className="landing-hero-visual relative isolate flex aspect-[3/2] max-h-[440px] items-end overflow-hidden border border-line-strong bg-raise lg:aspect-[10/9] lg:max-h-none">
        <Image
          src="/solar-field-sunrise.webp"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1240px) 510px, (min-width: 1024px) 44vw, 100vw"
          className="landing-hero-photo object-cover object-[60%_center]"
        />
        <span className="landing-visual-link">
          <Sun aria-hidden="true" size={20} strokeWidth={1.5} />
          Ver reloj solar
          <ArrowDownRight aria-hidden="true" size={18} className="ml-auto" />
        </span>
      </a>
    </section>
  );
}

const STEPS: { title: string; text: React.ReactNode }[] = [
  {
    title: "Regístrate como comercializador",
    text: "Entra con tu cuenta de Google y completa tus datos personales: nombre, documento, celular y ciudad de residencia.",
  },
  {
    title: "Elige un plan y paga el primer mes",
    text: `Por PSE o con tarjeta a través de Mercado Pago (con tarjeta, hasta ${formatCop(DEFAULT_MP_LIMITS.cardMaxCop)} por pago), con USDT o BNB desde tu wallet o, cuando está disponible, por transferencia bancaria. La energía empieza a contar cuando el pago queda confirmado.`,
  },
  {
    title: "Mira tu energía y retira",
    text: (
      <>
        Tu energía se genera cada día con el sol y se vende a{" "}
        <CatalogValue pick="sale" /> el kWh. El saldo lo retiras a una cuenta
        bancaria a tu nombre.
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="mx-auto max-w-[1240px] scroll-mt-24 px-5 sm:px-8"
    >
      <h2 className="display landing-reveal text-[clamp(3rem,7vw,5.5rem)]">Cómo funciona</h2>
      <ol className="mt-10 grid gap-0 border-t border-line-strong md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="border-b border-line py-8 md:border-b-0 md:border-l md:py-10 md:pl-8 md:pr-8 md:first:border-l-0 md:first:pl-0"
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

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "¿Qué compro como comercializador?",
    a: `Una cantidad de energía solar para ${PLAN_MONTHS} meses: ${SIZES.slice(0, -1).join(", ")} o ${SIZES.at(-1)} kWh, según el plan. La planta la genera día a día, siguiendo la curva del reloj solar.`,
  },
  {
    q: "¿De dónde sale la utilidad?",
    a: (
      <>
        Pagas cada kWh al precio de tu plan y esa energía se vende a{" "}
        <CatalogValue pick="sale" /> el kWh. La diferencia es la utilidad bruta.
        En el plan de <CatalogValue pick="topKwh" /> kWh, por ejemplo, pagas{" "}
        <CatalogValue pick="lowestPrice" /> y se vende a{" "}
        <CatalogValue pick="sale" />: <CatalogValue pick="topProfitPct" /> sobre
        lo que pagaste.
      </>
    ),
  },
  {
    q: "¿Cómo se paga?",
    a: `Mes a mes. Cada pago activa ${DAYS_PER_MONTH} días de energía. Si no pagas el mes siguiente, la energía se pausa; tienes ${GRACE_DAYS} días para ponerte al día antes de que el plan se cierre. Los meses que no pagas no se cobran ni se generan.`,
  },
  {
    q: "¿Cuándo puedo retirar?",
    a: `Cuando quieras, desde ${formatCop(MIN_WITHDRAWAL_COP)}. Cada kWh generado se abona a tu saldo al precio de venta. Nuestro equipo revisa cada retiro y lo paga a una cuenta bancaria a tu nombre, o en USDT a tu wallet.`,
  },
  {
    q: "¿Qué pasa de noche o con mal tiempo?",
    a: `La planta genera de ${SUNRISE} a ${SUNSET}, así que de noche el contador se detiene y vuelve a subir al amanecer. La energía de tu plan es una cantidad fija por día: no cambia con el clima.`,
  },
  {
    q: "¿El reloj solar es una medición en vivo?",
    a: "No. Es la curva de generación de la planta: muestra cómo se reparte la energía a lo largo del día, y con ella se calcula la energía de cada plan.",
  },
];

const FAQ_TEST: (typeof FAQ)[number] = {
  q: "¿Esta página ya cobra dinero real?",
  a: "Todavía no. Está en modo de pruebas: los pagos son de prueba y no se mueve dinero real.",
};

export function Faq() {
  const items = isDemoMode() ? [...FAQ, FAQ_TEST] : FAQ;
  return (
    <section
      id="preguntas"
      className="mx-auto max-w-[1240px] scroll-mt-24 px-5 sm:px-8"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <h2 className="display landing-reveal text-[clamp(3rem,7vw,5.5rem)]">Preguntas</h2>
        <div className="border-t border-line-strong">
          {items.map((f) => (
            <details key={f.q} className="group border-b border-line">
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
      <div className="flex flex-col gap-8 border-y border-line-strong py-14 md:flex-row md:items-end md:justify-between">
        <h2 className="display landing-reveal max-w-[14ch] text-[clamp(3rem,7vw,5.5rem)]">
          El sol sale todos los días.
        </h2>
        <div>
          <p className="max-w-[36ch] leading-relaxed text-fog">
            Elige un plan, paga el primer mes y mira tu energía subir desde el
            primer amanecer.
          </p>
          <AccountLink variant="cta" guestLabel="Empezar" className="mt-6" />
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
            {BRAND.legalName}.{" "}
            {isDemoMode()
              ? "Página en modo de pruebas: los pagos son de prueba y no se mueve dinero real. "
              : ""}
            La energía de cada plan se calcula con la curva de generación de la
            planta.
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
