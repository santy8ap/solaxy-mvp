import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { getSessionUser } from "@/lib/session";
import { Logo } from "@/components/ui/logo";
import { PaymentResult } from "@/components/payments/payment-result";

export const metadata: Metadata = { title: "Resultado del pago" };

type ResultParams = { ref?: string; payment_id?: string; collection_id?: string };

/** Mercado Pago vuelve aquí con ?ref=<orden> (nuestro) y payment_id / collection_id (suyos). */
async function Gate({ searchParams }: { searchParams: Promise<ResultParams> }) {
  const { ref, payment_id, collection_id } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/ingresar`);
  const paymentId = [payment_id, collection_id].find((v) => typeof v === "string" && /^\d+$/.test(v));
  return <PaymentResult orderRef={typeof ref === "string" ? ref : ""} paymentId={paymentId} />;
}

export default function ResultadoPage({ searchParams }: PageProps<"/pagos/resultado">) {
  return (
    <main className="relative flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <Logo />
        </Link>
        <Link href="/panel" className="text-sm text-silver-400 hover:text-silver-50">
          Ir a mi panel
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-[520px] flex-1 items-center px-5 pb-20">
        <Suspense fallback={<div className="h-[360px] w-full animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/60" />}>
          <Gate searchParams={searchParams as Promise<ResultParams>} />
        </Suspense>
      </div>
    </main>
  );
}
