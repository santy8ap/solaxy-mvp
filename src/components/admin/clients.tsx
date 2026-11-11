"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatCop, formatDate, formatNumber } from "@/lib/format";
import type { SubscriptionDTO } from "@/lib/portfolio";
import { ErrorNote, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PLAN_STATE, Status } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import type { AdminClient } from "./types";

const reloadAdmin = (url: string) => {
  void refetch(url);
  void refetch("/api/admin/overview");
  void refetch("/api/plans");
};

/** Registrar un pago que llegó por transferencia: el primer mes de un plan nuevo o el mes siguiente de uno que ya tiene. */
function ManualPaymentDialog({ client, onClose, listUrl }: { client: AdminClient | null; onClose(): void; listUrl: string }) {
  const { catalog } = useCatalog();
  const [target, setTarget] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!client) return null;
  const payable = client.plans.filter((p) => (p.state === "activa" || p.state === "en_pausa") && p.paidMonths < p.months);
  const options = [
    ...payable.map((p) => ({ value: `sub:${p.id}`, label: `${p.planName}: mes ${p.paidMonths + 1} de ${p.months} (${formatCop(p.monthlyCop)})` })),
    ...catalog.plans.filter((p) => p.available).map((p) => ({ value: `plan:${p.id}`, label: `${p.name} nuevo: mes 1 de ${p.months} (${formatCop(p.monthlyCop)})` })),
  ];
  const chosen = target || options[0]?.value || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const [kind, id] = chosen.split(":");
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/manual-payments", { userId: client.id, reference, ...(kind === "sub" ? { subscriptionId: id } : { planId: id }) });
      toast("Pago registrado: el mes quedó activo.");
      reloadAdmin(listUrl);
      setReference("");
      setTarget("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Registrar un pago" wide>
      <p className="leading-relaxed text-fog">
        Para pagos que llegaron por fuera de la página, como una transferencia bancaria de <strong className="font-medium text-ink">{client.profile?.companyName || client.profile?.fullName || client.name}</strong>. Al guardar, el mes
        queda activo y la energía empieza a contar.
      </p>
      <form onSubmit={submit} className="mt-7 space-y-6">
        <Field label="Qué paga">
          {(id, aria) => (
            <select id={id} {...aria} value={chosen} onChange={(e) => setTarget(e.target.value)} className="field">
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Referencia del pago" hint="El número del comprobante o de la transferencia. No se puede usar dos veces.">
          {(id, aria) => <input id={id} {...aria} value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" className="field num" />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-solid" disabled={busy || reference.trim().length < 4 || !chosen}>
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Guardando…
              </>
            ) : (
              "Registrar y activar"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ClosePlanDialog({ plan, onClose, listUrl }: { plan: SubscriptionDTO | null; onClose(): void; listUrl: string }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!plan) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/subscriptions/${plan.id}/close`, { reason });
      toast("Plan cerrado: dejó de generar energía.");
      reloadAdmin(listUrl);
      setReason("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={`Cerrar el ${plan.planName}`}>
      <p className="leading-relaxed text-fog">El plan deja de generar energía desde este momento y libera su cupo. Lo que ya generó se conserva en el saldo del cliente. No se puede deshacer.</p>
      <form onSubmit={submit} className="mt-7 space-y-6">
        <Field label="Motivo" hint="Queda en la bitácora. Por ejemplo: el banco devolvió el pago.">
          {(id, aria) => <input id={id} {...aria} value={reason} onChange={(e) => setReason(e.target.value)} autoComplete="off" className="field" />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-solid" disabled={busy || reason.trim().length < 4}>
            {busy ? "Cerrando…" : "Cerrar el plan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminClients() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const url = `/api/admin/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`;
  const { data, loading, error } = useJson<{ clients: AdminClient[] }>(url, { refreshMs: 30_000 });
  const [paying, setPaying] = useState<AdminClient | null>(null);
  const [closing, setClosing] = useState<SubscriptionDTO | null>(null);
  const clients = data?.clients ?? [];

  return (
    <>
      <AdminTopbar title="Clientes" subtitle="Los comercializadores registrados, sus planes, su energía y su saldo." />
      <form
        className="flex max-w-[520px] items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <div className="flex-1">
          <label htmlFor="q" className="cap">
            Buscar por nombre, documento o correo
          </label>
          <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="field" />
        </div>
        <button type="submit" className="btn btn-ghost">
          Buscar
        </button>
      </form>

      {error && <ErrorNote className="mt-8">{error}</ErrorNote>}
      <ul className="mt-10 border-t border-line-strong">
        {clients.map((c) => (
          <li key={c.id} className="border-b border-line py-7">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <h2 className="text-xl font-medium">{c.profile?.companyName || c.profile?.fullName || c.name}</h2>
                <p className="mt-1 break-words text-sm text-mute">
                  {c.profile?.nit ? `NIT ${c.profile.nit}, ` : ""}
                  {c.email}
                </p>
                {c.profile ? (
                  <p className="mt-1 text-sm text-mute">
                    Comercializador: {c.profile.fullName || "sin registrar"}
                    {c.profile.docNumber ? `, ${c.profile.docType} ${c.profile.docNumber}` : ""}. {c.profile.phone}, {c.profile.city}.
                  </p>
                ) : null}
                {!c.profile?.termsCurrent && (
                  <p className="mt-2.5">
                    <Status tone="wait">{c.profile ? "Falta completar los datos o aceptar los términos" : "No ha registrado sus datos personales"}</Status>
                  </p>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="cap">Energía</dt>
                  <dd className="num mt-1">{formatNumber(c.generatedKwh)} kWh</dd>
                </div>
                <div>
                  <dt className="cap">Saldo</dt>
                  <dd className="num mt-1">{formatCop(c.balanceCop)}</dd>
                </div>
                <div>
                  <dt className="cap">Retirado</dt>
                  <dd className="num mt-1">{formatCop(c.withdrawnCop)}</dd>
                </div>
              </dl>
              <button type="button" className="btn btn-ghost lg:justify-self-end" onClick={() => setPaying(c)} disabled={!c.profile?.termsCurrent} title={c.profile?.termsCurrent ? undefined : "El comercializador debe completar sus datos personales primero"}>
                Registrar un pago
              </button>
            </div>
            {c.plans.length > 0 && (
              <ul className="mt-5 border-t border-line">
                {c.plans.map((p) => {
                  const st = PLAN_STATE[p.state] ?? PLAN_STATE.borrador;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line py-3 text-sm last:border-b-0">
                      <span className="w-24 font-medium">{p.planName}</span>
                      <Status tone={st.tone}>{st.label}</Status>
                      <span className="num text-mute">
                        Mes {Math.min(p.paidMonths, p.months)} de {p.months}
                      </span>
                      <span className="num text-mute">Pagado hasta el {formatDate(p.paidUntil)}</span>
                      <span className="num text-mute">{formatCop(p.priceCopPerKwh)} / kWh</span>
                      <span className="num ml-auto text-dim">{p.id}</span>
                      {(p.state === "activa" || p.state === "en_pausa") && (
                        <button type="button" className="link text-fog" onClick={() => setClosing(p)}>
                          Cerrar el plan
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {!loading && clients.length === 0 && <p className="py-10 text-mute">{search ? "Ningún comercializador coincide con esa búsqueda." : "Todavía no hay comercializadores registrados."}</p>}

      <ManualPaymentDialog client={paying} onClose={() => setPaying(null)} listUrl={url} />
      <ClosePlanDialog plan={closing} onClose={() => setClosing(null)} listUrl={url} />
    </>
  );
}
