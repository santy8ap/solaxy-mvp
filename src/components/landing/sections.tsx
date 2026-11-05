import Link from "next/link";
import { BRAND } from "@/config/brand";
import { isDemoMode } from "@/lib/env";
import { cryptoConfig, mercadoPagoConfig } from "@/lib/payments/config";
import { Logo } from "@/components/ui/logo";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-silicon-600/40 bg-silicon-900/75 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8" aria-label="Principal">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <Logo />
        </Link>
        <div className="hidden items-center gap-7 text-sm text-silver-300 md:flex">
          <a href="#como-funciona" className="hover:text-silver-50">Cómo funciona</a>
          <a href="#planta" className="hover:text-silver-50">La planta</a>
          <a href="#simulador" className="hover:text-silver-50">Simulador</a>
          <a href="#preguntas" className="hover:text-silver-50">Preguntas</a>
        </div>
        <Link href="/ingresar" className="btn btn-ghost !px-4 !py-2.5 text-sm">
          Ingresar
        </Link>
      </nav>
    </header>
  );
}

const STEPS = [
  {
    title: "Entra con tu cuenta de Google",
    body: "Tu panel queda listo en segundos. No necesitas papeleo para empezar a ver la planta.",
  },
  {
    title: "Compra kW con tu wallet",
    body: "Desde 0,1 kW. Pagas con Trust Wallet, MetaMask o cualquier wallet compatible, en USDT, BNB, ETH o BTC.",
  },
  {
    title: "Gana con cada kWh que se entrega",
    body: "La energía de la planta se vende de día y, con la batería, también de noche. Tu parte se suma a tu saldo segundo a segundo.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8" aria-labelledby="como-title">
      <h2 id="como-title" className="display max-w-[18ch] text-[clamp(2rem,3.6vw,3rem)] text-silver-50">
        Tres pasos entre tu wallet y el sol
      </h2>
      <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-silicon-600/50 bg-silicon-600/50 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-silicon-850 p-7">
            <span className="display text-5xl text-sun-400">{i + 1}</span>
            <h3 className="mt-6 text-xl font-semibold text-silver-50">{s.title}</h3>
            <p className="mt-3 leading-relaxed text-silver-300">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Glyph({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg font-bold" style={{ borderColor: tone, color: tone }}>
      {children}
    </span>
  );
}

const WALLETS = [
  { name: "Trust Wallet", note: "Extensión o celular con QR", glyph: "TW", tone: "#7fb2ff" },
  { name: "MetaMask", note: "Extensión del navegador", glyph: "MM", tone: "#f6b73c" },
];

function paymentMethods() {
  const methods: { name: string; note: string; glyph: string; tone: string }[] = [];
  if (mercadoPagoConfig().enabled) {
    methods.push(
      { name: "Tarjeta", note: "Crédito o débito, con Mercado Pago", glyph: "$", tone: "#57d69b" },
      { name: "PSE y Nequi", note: "Desde tu banco o tu billetera (por PSE)", glyph: "⇄", tone: "#7fb2ff" },
    );
  }
  if (cryptoConfig().enabled) {
    methods.push(
      { name: "USDT", note: "BNB Smart Chain, directo a Solaxy", glyph: "₮", tone: "#57d69b" },
      { name: "BNB", note: "BNB Smart Chain, directo a Solaxy", glyph: "◆", tone: "#f6b73c" },
      ...WALLETS,
    );
  }
  if (isDemoMode()) {
    methods.push(...(cryptoConfig().enabled ? [] : WALLETS), { name: "Pago simulado", note: "Firma con tu wallet, sin mover fondos", glyph: "D", tone: "#a68bff" });
  }
  return methods;
}

export function Payments() {
  const demo = isDemoMode();
  const methods = paymentMethods();
  return (
    <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8" aria-labelledby="pagos-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 id="pagos-title" className="display text-[clamp(2rem,3.6vw,3rem)] text-silver-50">
            Paga como prefieras
          </h2>
          <p className="mt-4 max-w-[42ch] text-silver-300">
            Con tarjeta, PSE o Nequi a través de Mercado Pago, o con USDT y BNB desde tu wallet directo a la billetera de Solaxy. Tus kW se asignan apenas
            se confirma el pago.
          </p>
          {demo && <p className="mt-3 max-w-[42ch] text-sm text-silver-500">En modo demo también puedes simular un pago firmando con tu wallet, sin mover fondos.</p>}
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <li key={m.name} className="panel-quiet flex items-center gap-4 p-4">
              <Glyph tone={m.tone}>{m.glyph}</Glyph>
              <div>
                <div className="font-semibold text-silver-50">{m.name}</div>
                <div className="text-sm text-silver-400">{m.note}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "¿Qué compro exactamente?",
    a: "Una participación de la planta medida en kW. Si compras 2 kW de una planta de 2.000 kW, te corresponde el 0,1 % de la energía que entrega y de lo que se cobra por ella.",
  },
  {
    q: "¿De dónde salen las ganancias?",
    a: "De vender la energía. Cada kWh entregado se cobra a la tarifa del momento, más alta en la hora pico de la noche. Solaxy descuenta el 18 % para operación, mantenimiento y la plataforma, y el resto se reparte según los kW de cada persona.",
  },
  {
    q: "¿Qué pasa de noche o cuando está nublado?",
    a: "De noche la batería entrega la energía que guardó durante el día, entre las 6 y las 10 p. m. Los días nublados la planta produce menos. Por eso la rentabilidad es una estimación y no una tasa fija.",
  },
  {
    q: "¿Puedo vender mis kW?",
    a: "Sí. Puedes publicarlos en el mercado entre usuarios al precio que elijas, o venderlos al instante a la plataforma por el 97 % del precio actual.",
  },
  {
    q: "¿Cómo retiro mis ganancias?",
    a: "Tus ganancias se acumulan en tu saldo. Cuando quieras, pides el retiro a tu wallet en USDT y lo firmas; el equipo de Solaxy revisa la solicitud y te envía el dinero.",
  },
];

const FAQ_DEMO = {
  q: "¿Esto ya funciona con dinero real?",
  a: "En este modo demo, no: la planta, la telemetría y los pagos simulados no mueven fondos. La conexión de la wallet y la verificación de la firma sí son reales.",
};

const FAQ_LIVE = {
  q: "¿Esto ya funciona con dinero real?",
  a: "Sí. Los pagos con tarjeta, PSE y Nequi se procesan con Mercado Pago, y los pagos en USDT o BNB llegan directo a la billetera de Solaxy en BNB Chain. La planta todavía no tiene sus medidores conectados a la plataforma: la telemetría es una simulación y las ganancias que ves son estimadas.",
};

export function Faq() {
  return (
    <section id="preguntas" className="mx-auto max-w-[900px] scroll-mt-24 px-5 py-20 sm:px-8" aria-labelledby="faq-title">
      <h2 id="faq-title" className="display text-[clamp(2rem,3.6vw,3rem)] text-silver-50">
        Preguntas frecuentes
      </h2>
      <div className="mt-10 divide-y divide-silicon-600/50 border-y border-silicon-600/50">
        {[...FAQ, isDemoMode() ? FAQ_DEMO : FAQ_LIVE].map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold text-silver-50 [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="text-2xl font-normal text-sun-400 transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[68ch] leading-relaxed text-silver-300">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-24 pt-10 sm:px-8">
      <div className="panel cells flex flex-col items-start justify-between gap-8 overflow-hidden p-8 sm:p-12 lg:flex-row lg:items-center">
        <div>
          <h2 className="display max-w-[20ch] text-[clamp(2rem,3.6vw,3rem)] text-silver-50">El sol sale todos los días. Tus ganancias también.</h2>
          <p className="mt-4 text-silver-300">Empieza con 0,1 kW y mira tu primer peso ganado hoy mismo.</p>
        </div>
        <Link href="/ingresar" className="btn btn-sun shrink-0">
          Empezar a invertir
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-silicon-600/40">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 text-sm text-silver-400 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-[60ch]">
            {isDemoMode()
              ? `${BRAND.legalName}. Modo demo: la planta, la telemetría y los pagos son simulados, y ninguna firma mueve fondos. La rentabilidad que se muestra es estimada y no está garantizada.`
              : `${BRAND.legalName}. La telemetría de la planta es una simulación hasta que sus medidores estén conectados, y las ganancias que se muestran son estimadas. La rentabilidad no está garantizada.`}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <Link href="/terminos" className="hover:text-silver-50">
            Términos y Condiciones
          </Link>
          <Link href="/privacidad" className="hover:text-silver-50">
            Política de Tratamiento de Datos
          </Link>
          <p className="text-silver-500">Hecho en Colombia</p>
        </div>
      </div>
    </footer>
  );
}
