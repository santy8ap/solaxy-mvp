"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
} from "lucide-react";
import Link from "next/link";
import {
  ENERGY_PLANS,
  planSummary,
  type EnergyPlan,
} from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
import { nitCheckDigit } from "@/lib/profile-schema";
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
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [company, setCompany] = useState<CompanyDraft>(INITIAL_COMPANY);
  const [error, setError] = useState("");
  const field = (name: keyof CompanyDraft, value: string) => {
    setCompany((previous) => ({ ...previous, [name]: value }));
    setError("");
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
            revisión en pantalla. Se descartan al cerrar.
          </p>
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
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "company-draft-error" : undefined}
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
            <button type="button" className="btn btn-sun" disabled>
              Pago aún no habilitado
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
