"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { useCatalog } from "@/lib/client/use-catalog";
import { downloadCsv } from "@/lib/csv";
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

/** Atender una solicitud de eliminación de datos: eliminar la cuenta o responder por qué todavía no. */
function DataRequestDialog({ target, onClose, listUrl }: { target: { client: AdminClient; action: "eliminar" | "responder" } | null; onClose(): void; listUrl: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!target?.client.deletionRequest) return null;
  const { client, action } = target;
  const request = client.deletionRequest!;
  const remove = action === "eliminar";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/data-requests/${request.id}`, { action, note: note.trim() || undefined });
      toast(remove ? "Cuenta eliminada." : "Solicitud respondida.");
      reloadAdmin(listUrl);
      setNote("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={remove ? `Eliminar la cuenta de ${nameOf(client)}` : "Responder sin eliminar"} wide>
      {remove ? (
        <div className="space-y-3 leading-relaxed text-fog">
          <p>Se eliminan el acceso (sesiones e ingreso con Google), el correo, el celular, la ciudad y la wallet. Si pagó algún mes, se conservan su nombre, su documento y sus movimientos, que la ley contable obliga a guardar. No se puede deshacer.</p>
          <p>
            Antes, escríbele a <strong className="font-medium text-ink">{client.email}</strong> para confirmarle que su cuenta se eliminará: después ese correo ya no queda guardado.
          </p>
        </div>
      ) : (
        <p className="leading-relaxed text-fog">Cuéntale por qué todavía no se puede eliminar, por ejemplo, porque tiene un plan vigente o saldo por retirar. La respuesta queda guardada y el titular la ve en su perfil.</p>
      )}
      <form onSubmit={submit} className="mt-7 space-y-6">
        <Field label={remove ? "Nota (opcional)" : "Respuesta al titular"} hint={remove ? "Queda en la bitácora junto a lo que se eliminó." : "Mínimo 8 caracteres."}>
          {(id, aria) => <textarea id={id} {...aria} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="field" />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-solid" disabled={busy || (!remove && note.trim().length < 8)}>
            {busy ? "Guardando…" : remove ? "Eliminar la cuenta" : "Enviar la respuesta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Grupos de clientes según en qué va cada uno. */
const SEGMENTS = [
  { id: "todos", label: "Todos", test: () => true },
  { id: "generando", label: "Generando", test: (c: AdminClient) => c.plans.some((p) => p.state === "activa" || p.state === "en_revision") },
  { id: "en_pausa", label: "En pausa", test: (c: AdminClient) => c.plans.some((p) => p.state === "en_pausa") },
  { id: "por_confirmar", label: "Transferencia por confirmar", test: (c: AdminClient) => c.openTransfers > 0 },
  { id: "solicitudes", label: "Pidió eliminar su cuenta", test: (c: AdminClient) => !!c.deletionRequest },
  { id: "sin_pagar", label: "Sin pagar", test: (c: AdminClient) => !!c.profile?.termsCurrent && c.plans.length === 0 && c.openTransfers === 0 },
  { id: "sin_datos", label: "Sin datos", test: (c: AdminClient) => !c.profile?.termsCurrent },
] as const;
type Segment = (typeof SEGMENTS)[number]["id"];
const SEGMENT_IDS = new Set<string>(SEGMENTS.map((g) => g.id));

const nameOf = (c: AdminClient) => c.profile?.companyName || c.profile?.fullName || c.name;

function exportClients(list: AdminClient[]) {
  // La fecha del nombre del archivo, en hora de Colombia (UTC−5), como la exportación de pagos.
  const today = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
  downloadCsv(`clientes-${today}.csv`, [
    ["Cliente", "NIT", "Correo", "Titular", "Documento", "Celular", "Ciudad", "Cliente desde", "Último pago", "Planes generando", "Planes en pausa", "Energía kWh", "Saldo COP", "Retirado COP"],
    ...list.map((c) => [
      nameOf(c),
      c.profile?.nit ?? "",
      c.email,
      c.profile?.fullName ?? "",
      c.profile?.docNumber ? `${c.profile.docType} ${c.profile.docNumber}` : "",
      c.profile?.phone ?? "",
      c.profile?.city ?? "",
      formatDate(c.createdAt),
      c.lastPaymentAt ? formatDate(c.lastPaymentAt) : "",
      c.plans.filter((p) => p.state === "activa").length,
      c.plans.filter((p) => p.state === "en_pausa").length,
      Math.round(c.generatedKwh),
      c.balanceCop,
      c.withdrawnCop,
    ]),
  ]);
}

export function AdminClients() {
  // La búsqueda y el grupo también llegan por la URL: desde el Resumen o el Análisis.
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [search, setSearch] = useState(() => (params.get("q") ?? "").trim());
  const [segment, setSegment] = useState<Segment>(() => {
    const v = params.get("estado") ?? "";
    return SEGMENT_IDS.has(v) ? (v as Segment) : "todos";
  });
  const url = `/api/admin/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`;
  const { data, loading, error } = useJson<{ clients: AdminClient[] }>(url, { refreshMs: 30_000 });
  const [paying, setPaying] = useState<AdminClient | null>(null);
  const [closing, setClosing] = useState<SubscriptionDTO | null>(null);
  const [deciding, setDeciding] = useState<{ client: AdminClient; action: "eliminar" | "responder" } | null>(null);
  const all = data?.clients ?? [];
  const active = SEGMENTS.find((g) => g.id === segment) ?? SEGMENTS[0];
  const clients = all.filter((c) => active.test(c));

  return (
    <>
      <AdminTopbar title="Clientes" subtitle="Los comercializadores registrados, sus planes, su energía y su saldo." />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <form
          role="search"
          className="flex w-full max-w-[520px] items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <div className="flex-1">
            <label htmlFor="q" className="cap">
              Buscar por nombre, NIT, documento o correo
            </label>
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} className="field" />
          </div>
          <button type="submit" className="btn btn-ghost">
            Buscar
          </button>
        </form>
        <button type="button" className="link text-sm" disabled={!clients.length} onClick={() => exportClients(clients)}>
          Exportar esta lista (CSV)
        </button>
      </div>

      <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-line-strong pb-4" role="group" aria-label="Filtrar clientes">
        {SEGMENTS.map((g) => {
          const n = all.filter((c) => g.test(c)).length;
          if (g.id !== "todos" && g.id !== segment && n === 0) return null;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={segment === g.id}
              onClick={() => setSegment(g.id)}
              className={`border-b pb-1 text-sm transition-colors ${segment === g.id ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`}
            >
              {g.label} <span className="num">{n}</span>
            </button>
          );
        })}
      </div>
      {search && (
        <p className="mt-4 text-sm text-fog">
          Clientes que coinciden con «{search}».{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setSearch("");
              setQuery("");
            }}
          >
            Ver todos
          </button>
        </p>
      )}

      {error && <ErrorNote className="mt-8">{error}</ErrorNote>}
      <ul>
        {clients.map((c) => (
          <li key={c.id} className="border-b border-line py-7">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <h2 className="text-xl font-medium">{nameOf(c)}</h2>
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
                <p className="mt-1 text-sm text-mute">
                  Cliente desde el {formatDate(c.createdAt)}
                  {c.lastPaymentAt ? `. Último pago el ${formatDate(c.lastPaymentAt)}` : ". Todavía no ha pagado"}.
                </p>
                <p className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                  {!c.profile?.termsCurrent && <Status tone="wait">{c.profile ? "Falta completar los datos o aceptar los términos" : "No ha registrado sus datos personales"}</Status>}
                  {c.openTransfers > 0 && (
                    <Link href={`/admin/pagos?cliente=${encodeURIComponent(c.id)}&estado=en_proceso&metodo=transferencia`} className="hover:opacity-80">
                      <Status tone="act">{c.openTransfers === 1 ? "Transferencia por confirmar" : `${c.openTransfers} transferencias por confirmar`}</Status>
                    </Link>
                  )}
                </p>
                {c.deletionRequest && (
                  <div className="mt-4 border-l-2 border-ink pl-4 text-sm leading-relaxed">
                    <p className="font-medium">
                      Pidió eliminar su cuenta el {formatDate(c.deletionRequest.createdAt)}. Responde antes del {formatDate(c.deletionRequest.dueAt)}.
                    </p>
                    {c.deletionRequest.reason && <p className="mt-1 text-fog">Motivo: {c.deletionRequest.reason}</p>}
                    {c.deletionRequest.blockers.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-mute">
                        {c.deletionRequest.blockers.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-mute">Se puede eliminar: no tiene planes vigentes, saldo ni operaciones en curso.</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                      <button type="button" className="link" disabled={c.deletionRequest.blockers.length > 0} onClick={() => setDeciding({ client: c, action: "eliminar" })}>
                        Eliminar la cuenta
                      </button>
                      <button type="button" className="link" onClick={() => setDeciding({ client: c, action: "responder" })}>
                        Responder sin eliminar
                      </button>
                    </div>
                  </div>
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
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <button type="button" className="btn btn-ghost" onClick={() => setPaying(c)} disabled={!c.profile?.termsCurrent} title={c.profile?.termsCurrent ? undefined : "El comercializador debe completar sus datos personales primero"}>
                  Registrar un pago
                </button>
                {(c.lastPaymentAt || c.openTransfers > 0 || c.plans.length > 0) && (
                  <Link href={`/admin/pagos?cliente=${encodeURIComponent(c.id)}`} className="link text-sm">
                    Ver sus pagos
                  </Link>
                )}
              </div>
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
                      <span className="num text-mute">
                        {p.state === "en_pausa" && p.graceEndsAt ? `Puede pagar hasta el ${formatDate(p.graceEndsAt)}` : `Pagado hasta el ${formatDate(p.paidUntil)}`}
                      </span>
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
      {!loading && clients.length === 0 && (
        <p className="py-10 text-mute">{search ? "Ningún comercializador coincide con esa búsqueda." : segment !== "todos" ? "Ningún comercializador está en este grupo." : "Todavía no hay comercializadores registrados."}</p>
      )}

      <ManualPaymentDialog client={paying} onClose={() => setPaying(null)} listUrl={url} />
      <ClosePlanDialog plan={closing} onClose={() => setClosing(null)} listUrl={url} />
      <DataRequestDialog target={deciding} onClose={() => setDeciding(null)} listUrl={url} />
    </>
  );
}
