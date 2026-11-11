import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PLANS } from "@/config/plans";
import { CheckoutFlow } from "@/components/plans/checkout-flow";
import type { CheckoutRequest } from "@/lib/checkout";
import {
  loginHref,
  planCheckoutHref,
  renewalCheckoutHref,
} from "@/lib/navigation";
import { getCatalog, getSubscription, stateOf } from "@/lib/plans/service";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Comprar energía",
  robots: { index: false, follow: false },
};

type Params = { plan?: string; suscripcion?: string };

async function Purchase({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const { plan, suscripcion } = await searchParams;
  if ((!plan && !suscripcion) || (plan && suscripcion)) {
    return (
      <main className="mx-auto max-w-[700px] px-5 py-24">
        <h1 className="display text-5xl">Elige tu paquete de energía</h1>
        <p className="mt-5 leading-relaxed text-fog">
          Compara los precios de compra y venta y continúa con el paquete que
          prefieras.
        </p>
        <Link href="/#planes" className="btn btn-solid mt-8">
          Ver los paquetes
        </Link>
      </main>
    );
  }
  if (plan && !PLANS.some((p) => p.id === plan)) notFound();
  if (suscripcion && !/^PLN-[0-9A-F]{8}$/.test(suscripcion)) notFound();
  const destination = suscripcion
    ? renewalCheckoutHref(suscripcion)
    : planCheckoutHref(plan!);
  const user = await getSessionUser();
  if (!user) {
    redirect(loginHref(destination));
  }
  let request: CheckoutRequest;
  let available = true;
  if (suscripcion) {
    const sub = await getSubscription(suscripcion);
    if (!sub || sub.userId !== user.id) notFound();
    available =
      ["activa", "en_pausa"].includes(stateOf(sub)) &&
      sub.periods.length < sub.months;
    const kwh = sub.totalKwh / sub.months;
    request = {
      subscriptionId: sub.id,
      planName: sub.planName,
      periodIndex: sub.periods.length + 1,
      months: sub.months,
      kwh,
      amountCop: Math.round(kwh * sub.priceCopPerKwh),
      priceCopPerKwh: sub.priceCopPerKwh,
      saleCopPerKwh: sub.saleCopPerKwh,
    };
  } else {
    const catalog = await getCatalog();
    const p = catalog.plans.find((item) => item.id === plan);
    if (!p) notFound();
    available = p.available;
    request = {
      planId: p.id,
      planName: p.name,
      periodIndex: 1,
      months: p.months,
      kwh: p.monthlyKwh,
      amountCop: p.monthlyCop,
      priceCopPerKwh: p.priceCopPerKwh,
      saleCopPerKwh: p.saleCopPerKwh,
    };
  }
  return (
    <CheckoutFlow
      user={{ ...user, canAdmin: false }}
      request={request}
      available={available}
    />
  );
}

export default function PurchasePage({ searchParams }: PageProps<"/comprar">) {
  return (
    <Suspense
      fallback={
        <main
          className="mx-auto max-w-[1240px] space-y-8 px-5 py-16"
          aria-busy="true"
          aria-label="Cargando la compra"
        >
          <div className="skeleton h-12 w-56" />
          <div className="skeleton h-20" />
          <div className="skeleton h-96" />
        </main>
      }
    >
      <Purchase searchParams={searchParams as Promise<Params>} />
    </Suspense>
  );
}
