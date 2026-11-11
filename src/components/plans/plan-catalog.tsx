"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
  Bookmark,
  Download,
  Trash2,
  Printer,
} from "lucide-react";
import Link from "next/link";
import {
  ENERGY_PLANS,
  planSummary,
  type EnergyPlan,
} from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
import { nitCheckDigit } from "@/lib/profile-schema";
import { useSavedPlans } from "@/lib/client/use-saved-plans";
import { downloadFile, printDocument } from "@/lib/client/print-document";
import { signInHref } from "@/lib/navigation";
import { toast } from "@/components/ui/toast";
import { planProposalHtml } from "./plan-proposal";
import { Dialog } from "@/components/ui/dialog";
import { PlanCards } from "./plan-cards";
import { PlanComparator } from "./plan-comparator";

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

function PlanCheckout({ plan, close }: { plan: EnergyPlan; close(): void }) {
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
      <div className="checkout-notice">
        <FileText size={18} aria-hidden="true" />
        <p>
          Revisa los valores antes de decidir. La contratación y el pago mensual
          todavía no están habilitados.
        </p>
      </div>
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
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cerrar
            </button>
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
                href={signInHref(`/panel/planes?plan=${plan.id}`)}
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
          <p className="table-note">
            La selección no activa un contrato ni reserva energía. El cobro se
            habilitará al completar la contratación mensual.
          </p>
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

export function PlanCatalog({
  initialPlanId = "04",
}: {
  initialPlanId?: string;
}) {
  const [selected, setSelected] = useState<EnergyPlan>(
    () =>
      ENERGY_PLANS.find((plan) => plan.id === initialPlanId) ?? ENERGY_PLANS[3],
  );
  const [review, setReview] = useState(false);
  const saved = useSavedPlans();
  const summary = planSummary(selected);
  return (
    <div className="plan-catalog">
      <div className="panel-page-heading">
        <div>
          <span className="eyebrow">ENERGÍA A TU ESCALA</span>
          <h2>
            UNA DECISIÓN
            <br />
            CON PERSPECTIVA.
          </h2>
        </div>
        <p>
          Contrato de 3 meses.
          <br />
          Pago mensual en pesos colombianos.
          <br />
          <span className="muted">Compara cantidades, precios y valores.</span>
        </p>
      </div>
      <PlanCards selected={selected} onSelect={setSelected} />
      <section
        className="catalog-summary"
        aria-label="Resumen del plan seleccionado"
      >
        <div>
          <span className="eyebrow">
            PLAN {selected.name.toUpperCase()} / CADA 30 DÍAS
          </span>
          <p className="catalog-price" key={selected.id}>
            {formatCop(summary.monthlyCop)} <span>COP</span>
          </p>
          <p>
            {formatNumber(summary.monthlyKwh)} kWh al mes ·{" "}
            {formatNumber(summary.totalKwh)} kWh en total
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sun"
          onClick={() => setReview(true)}
        >
          Revisar plan <ArrowUpRight size={16} />
        </button>
      </section>
      <div className="catalog-facts">
        <div>
          <span>Precio por kWh</span>
          <strong>{formatCop(selected.price)}</strong>
        </div>
        <div>
          <span>Venta de referencia / kWh</span>
          <strong>$ 400</strong>
        </div>
        <div>
          <span>Utilidad bruta de referencia</span>
          <strong>{formatNumber(summary.grossMarginPct, 2)} %</strong>
        </div>
      </div>
      <p className="table-note">
        La utilidad bruta se calcula sobre el precio de compra, antes de costos
        e impuestos. Los valores son de referencia y no garantizan un
        rendimiento. Puedes revisar tu selección; la contratación mensual
        todavía no está habilitada.
      </p>
      <div className="catalog-links">
        <Link href="/#comparar" className="text-link">
          Comparar los cuatro planes <ArrowUpRight size={14} />
        </Link>
        <Link href="/terminos" className="text-link">
          Consultar términos <ArrowUpRight size={14} />
        </Link>
      </div>
      {saved.plans.length > 0 && (
        <section className="saved-plans" aria-labelledby="saved-plans-title">
          <span className="eyebrow">GUARDADAS EN ESTE NAVEGADOR</span>
          <h2 id="saved-plans-title">Tus selecciones, a mano.</h2>
          <p>
            Guardar una selección no activa un contrato. No se conservan datos
            de empresa.
          </p>
          <ul>
            {saved.plans.map((item) => {
              const plan = ENERGY_PLANS.find(
                (option) => option.id === item.planId,
              );
              if (!plan) return null;
              return (
                <li key={item.planId}>
                  <div>
                    <strong>Plan {plan.name}</strong>
                    <span>
                      {formatNumber(plan.daily)} kWh/día ·{" "}
                      {formatCop(planSummary(plan).monthlyCop)} COP/mes
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSelected(plan);
                      setReview(true);
                    }}
                  >
                    Reabrir <ArrowUpRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Eliminar selección del plan ${plan.name}`}
                    onClick={() => {
                      saved.remove(item.planId);
                      toast("Selección eliminada.");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <PlanComparator
        onSelect={(plan) => {
          setSelected(plan);
          setReview(true);
        }}
      />
      <Dialog
        open={review}
        onClose={() => setReview(false)}
        title={`Revisar plan ${selected.name}`}
      >
        <PlanCheckout
          key={selected.id}
          plan={selected}
          close={() => setReview(false)}
        />
      </Dialog>
    </div>
  );
}
