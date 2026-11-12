"use client";
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BRAND } from "@/config/brand";
import type { CheckoutRequest } from "@/lib/checkout";
import { formatCop, formatDateTime, formatNumber } from "@/lib/format";
import type { TxDTO } from "@/lib/portfolio";
import type { ProfileDTO } from "@/lib/profile";
import { WalletProvider } from "@/lib/wallet/context";
import { UserProvider, type PanelUser } from "@/components/panel/user-context";
import { ProfileForm, useProfile } from "@/components/profile/profile-form";
import { ErrorNote } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { ReceiptButton } from "@/components/payments/receipt-button";
import { SupportContacts } from "@/components/support/support-contacts";
import { Toaster } from "@/components/ui/toast";
import { ConnectWalletDialog } from "@/components/wallet/connect-dialog";
import { CheckoutPayment } from "./checkout";
import { CheckoutProgress } from "./checkout-progress";
import { PriceBreakdown } from "./price-breakdown";

const TITLES = [
  "Tus datos, tu energía.",
  "Así es tu plan.",
  "Un paso para empezar.",
  "Tu energía ya cuenta.",
];

export function CheckoutFlow({
  user,
  request,
  available,
}: {
  user: PanelUser;
  request: CheckoutRequest;
  available: boolean;
}) {
  return (
    <UserProvider user={user}>
      <WalletProvider>
        <Purchase request={request} available={available} />
        <ConnectWalletDialog />
        <Toaster />
      </WalletProvider>
    </UserProvider>
  );
}

function Purchase({
  request,
  available,
}: {
  request: CheckoutRequest;
  available: boolean;
}) {
  const { data, error } = useProfile();
  const [savedProfile, setSavedProfile] = useState<ProfileDTO | null>(null);
  const profile = savedProfile ?? data?.profile;
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<TxDTO | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const move = useCallback((next: number) => {
    setStep(next);
    requestAnimationFrame(() => {
      title.current?.focus();
      title.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }, []);
  const confirmed = useCallback(
    (paid: TxDTO) => {
      setOrder(paid);
      setBusy(false);
      move(4);
    },
    [move],
  );
  const complete = Boolean(profile?.complete);
  const isTest =
    order?.method === "demo" ||
    order?.chainId === 97 ||
    Boolean(order?.network?.includes("pruebas"));

  return (
    <div className="min-h-dvh bg-void">
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-[80px] max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label={`${BRAND.name}, inicio`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href={step === 4 ? "/panel" : "/panel/planes"}
              aria-disabled={busy || undefined}
              onClick={(event) => busy && event.preventDefault()}
              className="link text-right text-sm text-fog"
            >
              {step === 4 ? "Ir a mi panel" : "Volver a los planes"}
            </Link>
            <ThemeSelector />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <p className="cap mb-7">Tu compra de energía · {request.planName}</p>
        <CheckoutProgress current={step} />
        {!available ? (
          <section className="py-16">
            <h1 className="display text-5xl">
              Este plan no está disponible.
            </h1>
            <p className="mt-5 max-w-[55ch] leading-relaxed text-fog">
              El cupo o el período disponible para este pago cambió. Consulta
              los planes vigentes para continuar.
            </p>
            <Link href="/panel/planes" className="btn btn-solid mt-8">
              Ver planes disponibles
            </Link>
          </section>
        ) : (
          <div className="grid min-w-0 gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
            <section
              className="min-w-0 motion-safe:animate-[checkout-step-enter_250ms_ease-out]"
              key={step}
            >
              <h1
                ref={title}
                tabIndex={-1}
                className="display scroll-mt-8 text-[clamp(2.8rem,6vw,5rem)] outline-none"
              >
                {TITLES[step - 1]}
              </h1>
              {step === 1 && (
                <>
                  <p className="mb-8 mt-5 max-w-[55ch] leading-relaxed text-fog">
                    Identifica al titular de este plan. Tus datos personales
                    se conservan para las próximas compras.
                  </p>
                  {error ? (
                    <ErrorNote>{error}</ErrorNote>
                  ) : !data ? (
                    <div
                      className="skeleton h-80"
                      aria-busy="true"
                      aria-label="Cargando datos personales"
                    />
                  ) : complete && !editing ? (
                    <>
                      <dl className="grid gap-x-8 gap-y-6 border-y border-line py-7 sm:grid-cols-2">
                        {[
                          ["Titular", profile!.fullName],
                          [
                            "Documento",
                            `${profile!.docType} ${profile!.docNumber}`,
                          ],
                          ["Correo", data.email],
                          ["Celular", profile!.phone],
                          ["Ciudad", profile!.city],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="cap">{label}</dt>
                            <dd className="mt-2 break-words text-fog">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                        <button
                          type="button"
                          className="link text-sm text-fog"
                          onClick={() => setEditing(true)}
                        >
                          Editar mis datos
                        </button>
                        <button
                          type="button"
                          className="btn btn-solid"
                          onClick={() => move(2)}
                        >
                          Continuar al resumen <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <ProfileForm
                      submitLabel="Guardar y continuar al resumen"
                      onSaved={(saved) => {
                        setSavedProfile(saved);
                        setEditing(false);
                        move(2);
                      }}
                    />
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <p className="mt-5 max-w-[56ch] leading-relaxed text-fog">
                    Revisa el precio de compra, el valor de venta y la utilidad
                    bruta de tu plan. Hoy pagas únicamente el mes{" "}
                    {request.periodIndex} de {request.months}.
                  </p>
                  <PriceBreakdown
                    monthlyKwh={request.kwh}
                    months={request.months}
                    priceCopPerKwh={request.priceCopPerKwh}
                    saleCopPerKwh={request.saleCopPerKwh}
                  />
                  <p className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-fog">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                    Cada pago confirmado activa 30 días.{" "}
                    {request.periodIndex > 1
                      ? "Si aún tienes un mes activo, el nuevo período comienza cuando termine el actual."
                      : "La energía comienza a contar cuando se confirma el primer pago."}
                  </p>
                  <div className="mt-8 flex flex-wrap justify-between gap-4">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => move(1)}
                    >
                      <ArrowLeft size={15} /> Mis datos
                    </button>
                    <button
                      type="button"
                      className="btn btn-solid"
                      onClick={() => move(3)}
                    >
                      Elegir medio de pago <ArrowUpRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <p className="mt-5 leading-relaxed text-fog">
                    Elige el medio de pago para activar el mes{" "}
                    {request.periodIndex} de tu plan.
                  </p>
                  {!complete ? (
                    <>
                      <ErrorNote className="mt-7">
                        Revisa y guarda tus datos personales antes de continuar.
                      </ErrorNote>
                      <button
                        type="button"
                        className="btn btn-ghost mt-5"
                        onClick={() => move(1)}
                      >
                        Volver a mis datos
                      </button>
                    </>
                  ) : (
                    <>
                      <CheckoutPayment
                        request={request}
                        onClose={() => move(2)}
                        onBusy={setBusy}
                        onConfirmed={confirmed}
                      />
                      <SupportContacts />
                    </>
                  )}
                </>
              )}
              {step === 4 && order && (
                <>
                  <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-void">
                    <Check size={28} />
                  </div>
                  <p className="mt-6 text-lg leading-relaxed text-fog">
                    El pago del mes {order.periodIndex} está confirmado. Puedes
                    consultar la energía y los movimientos de tu plan desde
                    tu panel.
                  </p>
                  {isTest && (
                    <p className="mt-5 border-l-2 border-ink pl-4 text-sm text-fog">
                      Operación de prueba: no se movió dinero real.
                    </p>
                  )}
                  <dl className="mt-8 space-y-4 border-y border-line py-6">
                    {[
                      ["Referencia", order.id],
                      [
                        "Fecha de confirmación",
                        formatDateTime(order.confirmedAt ?? order.createdAt),
                      ],
                      ["Pago confirmado", formatCop(order.amountCop)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex flex-wrap justify-between gap-3"
                      >
                        <dt className="cap">{label}</dt>
                        <dd className="num break-all text-sm">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/panel" className="btn btn-solid">
                      Ver mi energía <ArrowUpRight size={16} />
                    </Link>
                    <ReceiptButton id={order.id} />
                  </div>
                </>
              )}
            </section>
            <aside
              className="min-w-0 self-start border border-line-strong p-6 lg:sticky lg:top-8"
              aria-label="Resumen del plan"
            >
              <p className="cap">Tu plan de energía</p>
              <h2 className="display mt-3 text-4xl">{request.planName}</h2>
              <dl className="mt-6 space-y-5 border-y border-line py-6">
                {[
                  [
                    "Mes que pagas",
                    `${request.periodIndex} de ${request.months}`,
                  ],
                  ["Energía del mes", `${formatNumber(request.kwh)} kWh`],
                  ["Compra por kWh", formatCop(request.priceCopPerKwh)],
                  ["Venta por kWh", formatCop(request.saleCopPerKwh)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <dt className="text-sm text-mute">{label}</dt>
                    <dd className="num text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="cap mt-6">Total de este mes</p>
              <p className="num mt-3 break-words text-[1.7rem]">
                {formatCop(order?.amountCop ?? request.amountCop)}
              </p>
              <p className="mt-2 text-xs text-mute">
                Pesos colombianos · pago mensual
              </p>
              <p className="mt-6 text-sm leading-relaxed text-fog">
                La utilidad corresponde a la diferencia entre compra y venta,
                antes de costos e impuestos.
              </p>
              <Link
                href="/ayuda"
                className="link mt-6 inline-block text-sm text-fog"
              >
                Ayuda con mi compra
              </Link>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
