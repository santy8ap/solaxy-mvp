import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { AccountLink } from "@/components/auth/account-link";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { SupportContacts } from "@/components/support/support-contacts";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Ayuda con compras de energía, pagos, mensualidades y retiros.",
};

async function Contacts({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return (
    <SupportContacts
      reference={ref && /^[A-Za-z0-9-]{1,80}$/.test(ref) ? ref : undefined}
    />
  );
}

export default function HelpPage({ searchParams }: PageProps<"/ayuda">) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-20 max-w-[1100px] items-center justify-between px-5">
          <Link href="/" aria-label={`${BRAND.name}, inicio`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <AccountLink />
            <ThemeSelector />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-12 sm:pt-20">
        <p className="cap">Estamos para ayudarte</p>
        <h1 className="display mt-4 max-w-[16ch] text-[clamp(3rem,8vw,6.5rem)]">
          Tu energía, con respuestas.
        </h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-fog">
          Consulta el estado de tu compra y encuentra los pasos para resolver
          dudas sobre pagos, planes y retiros.
        </p>
        <Suspense fallback={<div className="skeleton mt-10 h-24" />}>
          <Contacts searchParams={searchParams as Promise<{ ref?: string }>} />
        </Suspense>
        <div className="mt-12 grid gap-x-12 sm:grid-cols-2">
          {[
            [
              "Mi pago sigue pendiente",
              "Algunos medios tardan en confirmar el resultado. Abre tus movimientos y consulta el pago con su referencia. Evita repetirlo mientras se confirma.",
              "/panel/billetera",
              "Consultar movimientos",
            ],
            [
              "Quiero pagar la próxima mensualidad",
              "En tus planes encontrarás el mes disponible y el valor contratado. Pagar antes del vencimiento permite continuar sin pausa.",
              "/panel/planes",
              "Ver mis planes",
            ],
            [
              "Necesito mi comprobante",
              "Puedes descargar el PDF de un pago o retiro confirmado desde el historial de movimientos.",
              "/panel/billetera",
              "Buscar comprobante",
            ],
            [
              "Necesito actualizar mis datos",
              "Actualiza tu nombre, documento, celular o ciudad desde tu perfil de comercializador.",
              "/panel/perfil",
              "Revisar mis datos",
            ],
          ].map(([title, detail, href, action]) => (
            <section key={title} className="border-t border-line py-8">
              <h2 className="text-xl font-medium">{title}</h2>
              <p className="mt-3 leading-relaxed text-fog">{detail}</p>
              <Link href={href} className="link mt-5 inline-block text-sm">
                {action}
              </Link>
            </section>
          ))}
        </div>
        <p className="mt-8 border-t border-line pt-7 text-sm text-mute">
          También puedes consultar los{" "}
          <Link href="/terminos" className="link">
            Términos y Condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="link">
            Política de Datos
          </Link>
          .
        </p>
      </main>
    </>
  );
}
