import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, Check, Info } from "lucide-react";
import { PublicFrame } from "@/components/public/public-frame";
import { LogoMark } from "@/components/ui/logo";
import { ENERGY_PLANS } from "@/config/energy-plans";
import { googleEnabled, isDemoMode } from "@/lib/env";
import { safeDestination } from "@/lib/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginOptions } from "./login-options";

export const metadata: Metadata = { title: "Ingresar" };

async function LoginExperience({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  await connection();
  const { rol, next } = await searchParams;
  const destination = safeDestination(next);
  const purchasePlan = ENERGY_PLANS.find((plan) => destination === `/comprar/${plan.id}`);
  const admin = !purchasePlan && rol === "admin";
  if (!admin && await getSessionUser()) redirect(destination);
  const demo = isDemoMode();

  return (
    <>
      <nav className="access-breadcrumb" aria-label="Ruta de navegación">
        <Link href={purchasePlan ? `/planes?plan=${purchasePlan.id}` : "/"}>
          <ArrowLeft size={14} aria-hidden="true" /> {purchasePlan ? "Planes de energía" : "Inicio"}
        </Link>
        <span aria-hidden="true">/</span><span aria-current="page">Ingresar</span>
      </nav>
      <div className="access-layout">
        <section className="access-intro" aria-labelledby="access-title">
          <span className="eyebrow">IN WORLD ENERGY / ESPACIO EMPRESARIAL</span>
          <h1 id="access-title">
            {purchasePlan ? <>TU PLAN.<br />TU EMPRESA.<br /><span>TU ENERGÍA.</span></> : <>TU ENERGÍA.<br />BAJO UNA<br /><span>MISMA VISIÓN.</span></>}
          </h1>
          <p>{purchasePlan
            ? "Ya elegiste tu escala. Ingresa a tu cuenta y continúa con los datos de tu empresa."
            : "Un espacio para explorar tus planes de energía, consultar tu actividad y mantener al día la información de tu empresa."}</p>
          <div className="access-brand-art" aria-hidden="true">
            <div className="access-art-grid" />
            <div className="access-art-orbit" />
            <LogoMark size={118} />
            <span className="mono">ENERGÍA SOLAR / VISIÓN EMPRESARIAL</span>
          </div>
          {purchasePlan ? (
            <ol className="access-journey" aria-label="Recorrido de compra">
              <li><span><Check size={12} aria-hidden="true" /></span> Plan elegido</li>
              <li aria-current="step"><span>02</span> Ingreso a tu cuenta</li>
              <li><span>03</span> Revisión de compra</li>
            </ol>
          ) : (
            <div className="access-intro-note"><span className="eyebrow">UNA MISMA VISIÓN</span><p>Desde el primer plan hasta el seguimiento de tu cuenta.</p></div>
          )}
        </section>

        <section className="access-card" aria-labelledby="access-form-title">
          <div className="access-card-header">
            <span className="eyebrow">{purchasePlan ? "CONTINÚA CON TU PLAN" : admin ? "ACCESO DE ADMINISTRACIÓN" : "ACCESO A TU CUENTA"}</span>
            <h2 id="access-form-title">Inicia sesión.</h2>
            <p>{purchasePlan ? "Conservamos tu selección para que sigas donde estabas." : "Elige cómo quieres continuar."}</p>
          </div>
          <LoginOptions
            key={destination}
            googleEnabled={googleEnabled}
            demoMode={demo}
            defaultRole={admin ? "admin" : "user"}
            destination={destination}
          />
          {demo && (
            <div className="access-environment-note" role="note">
              <Info size={15} aria-hidden="true" />
              <p>Entorno de demostración. Las lecturas de planta y la posición inicial de las cuentas son simuladas.</p>
            </div>
          )}
          <p className="access-legal">Consulta los <Link href="/terminos">términos</Link> y nuestra <Link href="/privacidad">política de privacidad</Link>.</p>
        </section>
      </div>
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <PublicFrame
      contentClassName="access-content"
      accountAction={<Link href="/" className="btn btn-ghost"><ArrowLeft size={14} aria-hidden="true" /> Inicio</Link>}
    >
      <Suspense fallback={
        <div className="access-loading" role="status" aria-label="Preparando el ingreso">
          <span className="eyebrow">IN WORLD ENERGY</span><p>Preparando tu ingreso…</p>
        </div>
      }>
        <LoginExperience searchParams={searchParams} />
      </Suspense>
    </PublicFrame>
  );
}
