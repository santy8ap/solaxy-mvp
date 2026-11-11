"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Check, FileText, Bookmark, Download, Printer } from "lucide-react";
import Link from "next/link";
import { planSummary, type EnergyPlan } from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
import { nitCheckDigit } from "@/lib/profile-schema";
import { useSavedPlans } from "@/lib/client/use-saved-plans";
import { downloadFile, printDocument } from "@/lib/client/print-document";
import { signInHref } from "@/lib/navigation";
import { toast } from "@/components/ui/toast";
import { planProposalHtml } from "./plan-proposal";

interface CompanyDraft {
  company: string;
  nit: string;
  representative: string;
  email: string;
}
const INITIAL_COMPANY: CompanyDraft = {
  company: "",
  nit: "",
  representative: "",
  email: "",
};

function PlanReview({ plan }: { plan: EnergyPlan }) {
  const summary = planSummary(plan);
  return (
    <dl className="detail-list">
      <div>
        <dt>Plan</dt>
        <dd>{plan.name}</dd>
      </div>
      <div>
        <dt>Energía mensual</dt>
        <dd>{formatNumber(summary.monthlyKwh)} kWh</dd>
      </div>
      <div>
        <dt>Duración</dt>
        <dd>3 meses · Periodos de 30 días</dd>
      </div>
      <div>
        <dt>Precio de compra</dt>
        <dd>{formatCop(plan.price)} / kWh</dd>
      </div>
      <div>
        <dt>Cuota mensual</dt>
        <dd>{formatCop(summary.monthlyCop)} COP</dd>
      </div>
      <div>
        <dt>Total de los 3 meses</dt>
        <dd>{formatCop(summary.monthlyCop * 3)} COP</dd>
      </div>
    </dl>
  );
}

export function PlanCheckout({
  plan,
  close,
  presentation = "dialog",
}: {
  plan: EnergyPlan;
  close?: () => void;
  presentation?: "dialog" | "page";
}) {
  const saved = useSavedPlans();
  const isSaved = saved.plans.some((item) => item.planId === plan.id);
  const [importing, setImporting] = useState(false);
  const [signInNeeded, setSignInNeeded] = useState(false);
  const saveSelection = () => {
    if (isSaved) {
      saved.remove(plan.id);
      toast("Selección eliminada de este navegador.");
      return;
    }
    const persisted = saved.save(plan.id);
    toast(
      persisted
        ? "Plan guardado en este navegador."
        : "Plan guardado en esta pestaña. El navegador no permite conservarlo.",
      persisted ? "ok" : "info",
    );
  };
  const proposal = (includeCompany: boolean) => {
    try {
      downloadFile(
        planProposalHtml(plan, includeCompany ? company : undefined),
        "text/html;charset=utf-8",
        `in-world-energy-propuesta-${plan.id}.html`,
      );
      toast("Propuesta descargada. Ábrela para imprimir o guardar como PDF.");
    } catch {
      toast("No se pudo descargar la propuesta. Inténtalo de nuevo.", "error");
    }
  };
  const printProposal = async (includeCompany: boolean) => {
    try {
      await printDocument(
        planProposalHtml(plan, includeCompany ? company : undefined),
        "Propuesta de energía",
      );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "No se pudo abrir la impresión.",
        "error",
      );
    }
  };
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastStep = useRef(step);
  useEffect(() => {
    if (presentation === "page" && lastStep.current !== step) {
      headingRef.current?.focus();
      lastStep.current = step;
    }
  }, [step, presentation]);
  const [company, setCompany] = useState<CompanyDraft>(INITIAL_COMPANY);
  const [error, setError] = useState("");
  const [nitInvalid, setNitInvalid] = useState(false);
  const field = (name: keyof CompanyDraft, value: string) => {
    setCompany((previous) => ({ ...previous, [name]: value }));
    setError("");
    setNitInvalid(false);
  };
  return (
    <>
      <ol className="checkout-steps" aria-label="Pasos de revisión">
        {["Tu plan", "Tu empresa", "Resumen"].map((label, i) => (
          <li key={label} aria-current={step === i ? "step" : undefined}>
            <span>{i < step ? <Check size={12} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {presentation === "dialog" && (
        <div className="checkout-notice">
          <FileText size={18} aria-hidden="true" />
          <p>
            Revisa los valores antes de decidir. La contratación y el pago mensual
            todavía no están habilitados.
          </p>
        </div>
      )}
      {presentation === "page" && (
        <div className="purchase-step-heading">
          <span className="eyebrow">0{step + 1} / {step === 0 ? "TU ELECCIÓN" : step === 1 ? "DATOS EMPRESARIALES" : "REVISIÓN FINAL"}</span>
          <h2 tabIndex={-1} ref={headingRef}>
            {step === 0 ? "Todo empieza con tu plan." : step === 1 ? "La energía de tu empresa." : "Cada detalle, en su lugar."}
          </h2>
          <p>{step === 0 ? "Confirma las cantidades y el valor mensual antes de continuar." : step === 1 ? "Estos datos identificarán a la empresa que contrata la energía." : "Revisa tus datos y conserva la propuesta de tu selección."}</p>
        </div>
      )}
      {step === 0 ? (
        <>
          <PlanReview plan={plan} />
          <p className="table-note">
            Los datos que escribas en el siguiente paso solo se usan para esta
            revisión en pantalla. Se descartan al cerrar; guardar el plan
            conserva únicamente su selección.
          </p>
          <div className="proposal-quick-actions">
            <button
              type="button"
              className="text-link"
              onClick={() => void printProposal(false)}
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
            <button type="button" className="text-link" onClick={saveSelection}>
              <Bookmark size={14} />
              {isSaved ? "Quitar guardado" : "Guardar selección"}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => proposal(false)}
            >
              <Download size={14} /> Descargar propuesta
            </button>
          </div>
          <div className="dialog-actions">
            {presentation === "page" ? (
              <Link href={`/planes?plan=${plan.id}`} className="btn btn-ghost">
                <ArrowLeft size={14} /> Cambiar plan
              </Link>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={close}>
                Cerrar
              </button>
            )}
            <button
              type="button"
              className="btn btn-sun"
              onClick={() => setStep(1)}
            >
              Continuar <ArrowRight size={14} />
            </button>
          </div>
        </>
      ) : step === 1 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const nit = company.nit.replace(/[.\s]/g, "");
            const match = /^(\d{8,10})(?:-(\d))?$/.exec(nit);
            if (
              !match ||
              (match[2] !== undefined &&
                Number(match[2]) !== nitCheckDigit(match[1]))
            ) {
              setNitInvalid(true);
              setError(
                "Revisa el NIT y su dígito de verificación. Ejemplo: 900123456-8.",
              );
              return;
            }
            if (
              company.company.trim().length < 3 ||
              company.representative.trim().length < 5
            ) {
              setError(
                "Completa la razón social y el nombre del representante legal.",
              );
              return;
            }
            setStep(2);
          }}
          className="company-draft"
        >
          <div className="proposal-account-import">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={importing}
              onClick={async () => {
                setImporting(true);
                setError("");
                setNitInvalid(false);
                setSignInNeeded(false);
                try {
                  const response = await fetch("/api/profile", {
                    cache: "no-store",
                  });
                  if (response.status === 401) {
                    setError("Inicia sesión para usar los datos de tu cuenta.");
                    setSignInNeeded(true);
                    return;
                  }
                  if (!response.ok)
                    throw new Error(
                      "No pudimos cargar tus datos. Puedes completarlos manualmente.",
                    );
                  const result = (await response.json()) as {
                    profile: {
                      fullName: string;
                      docType: string;
                      docNumber: string;
                    } | null;
                    email: string;
                  };
                  if (!result.profile || result.profile.docType !== "NIT") {
                    setError(
                      "Tu cuenta aún no tiene datos de empresa con NIT. Puedes completar este formulario manualmente.",
                    );
                    return;
                  }
                  setCompany((previous) => ({
                    ...previous,
                    company: result.profile!.fullName,
                    nit: result.profile!.docNumber,
                    email: result.email,
                  }));
                  toast(
                    "Datos de empresa cargados. Completa el representante legal.",
                  );
                } catch (exception) {
                  setError(
                    exception instanceof Error
                      ? exception.message
                      : "No pudimos cargar los datos.",
                  );
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "Cargando datos…" : "Usar datos de mi cuenta"}
            </button>
            {signInNeeded && (
              <Link
                href={signInHref(presentation === "page" ? `/comprar/${plan.id}` : `/panel/planes?plan=${plan.id}`)}
                className="text-link"
              >
                Iniciar sesión y volver al plan <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <label>
            Razón social
            <input
              required
              autoComplete="organization"
              maxLength={100}
              minLength={3}
              value={company.company}
              onChange={(event) => field("company", event.target.value)}
            />
          </label>
          <label>
            NIT
            <input
              required
              inputMode="text"
              placeholder="900123456-8"
              maxLength={16}
              value={company.nit}
              onChange={(event) => field("nit", event.target.value)}
              aria-invalid={nitInvalid}
              aria-describedby={nitInvalid ? "company-draft-error" : undefined}
            />
          </label>
          <label>
            Representante legal
            <input
              required
              autoComplete="name"
              maxLength={100}
              minLength={5}
              value={company.representative}
              onChange={(event) => field("representative", event.target.value)}
            />
          </label>
          <label>
            Correo empresarial
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={150}
              value={company.email}
              onChange={(event) => field("email", event.target.value)}
            />
          </label>
          {error && (
            <p id="company-draft-error" role="alert" className="table-note">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(0)}
            >
              <ArrowLeft size={14} /> Atrás
            </button>
            <button type="submit" className="btn btn-sun">
              Revisar resumen <ArrowRight size={14} />
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="company-review">
            <span className="eyebrow">EMPRESA</span>
            <h3>{company.company.trim()}</h3>
            <p>
              NIT {company.nit} · {company.representative.trim()}
            </p>
            <p>{company.email}</p>
          </div>
          <PlanReview plan={plan} />
          <div className="checkout-notice purchase-billing-notice" role="note">
            <FileText size={18} aria-hidden="true" />
            <p>
              <strong>El pago mensual aún no está disponible.</strong> Puedes
              guardar o descargar esta propuesta. Tu selección no activa un
              contrato, no reserva energía y no genera ningún cobro.
            </p>
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(1)}
            >
              Editar datos
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={saveSelection}
            >
              <Bookmark size={14} />
              {isSaved ? "Quitar guardado" : "Guardar selección"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void printProposal(true)}
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
            <button
              type="button"
              className="btn btn-sun"
              onClick={() => proposal(true)}
            >
              <Download size={14} /> Descargar propuesta
            </button>
          </div>
        </>
      )}
    </>
  );
}

