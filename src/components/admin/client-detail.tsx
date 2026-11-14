"use client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatDate, formatDateTime, formatNumber, shortAddress } from "@/lib/format";
import { adminMethodLabel } from "@/lib/labels";
import type { SubscriptionDTO, TxDTO } from "@/lib/portfolio";
import { explorerTxUrl } from "@/components/panel/tx-meta";
import { ErrorNote } from "@/components/ui/field";
import { PLAN_STATE, Status, TX_STATUS } from "@/components/ui/status";
import { ClosePlanDialog, DataRequestDialog, ManualPaymentDialog } from "./clients";
import { AdminTopbar } from "./shell";
import { actionLabel, type AdminClient } from "./types";

interface Detail {
  client: AdminClient;
  lastLoginAt: number | null;
  activeSessions: number;
  wallet: { address: string; walletName: string; chainId: number | null; connectedAt: number } | null;
  movements: (TxDTO & { providerId: string | null })[];
  emails: { key: string; kind: string; subject: string; status: string; attempts: number; error: string | null; at: number }[];
  activity: { id: string; action: string; summary: string; actorName: string; createdAt: number }[];
  requests: { id: string; kind: string; status: string; reason: string | null; createdAt: number; dueAt: number; resolvedAt: number | null; resolution: string | null }[];
}

const nameOf = (c: AdminClient) => c.profile?.companyName || c.profile?.fullName || c.name;
const EMAIL_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "off" }> = {
  enviado: { label: "Entregado a Resend", tone: "ok" },
  enviando: { label: "Enviando", tone: "wait" },
  fallido: { label: "No se pudo enviar", tone: "off" },
};
const REQUEST_STATUS: Record<string, string> = { pendiente: "Pendiente", atendida: "Cuenta eliminada", respondida: "Respondida sin eliminar" };

/** La ficha de un comercializador: todo lo que el equipo necesita para atenderlo, en una sola página. */
export function AdminClientDetail({ id }: { id: string }) {
  const url = `/api/admin/clients/${encodeURIComponent(id)}`;
  const { data, error } = useJson<Detail>(url, { refreshMs: 30_000 });
  const [paying, setPaying] = useState(false);
  const [closing, setClosing] = useState<SubscriptionDTO | null>(null);
  const [deciding, setDeciding] = useState<"eliminar" | "responder" | null>(null);

  const back = (
    <Link href="/admin/clientes" className="link inline-flex items-center gap-1.5 text-sm text-fog">
      <ArrowLeft size={14} strokeWidth={1.5} /> Clientes
    </Link>
  );
  if (error)
    return (
      <>
        <AdminTopbar title="Cliente" action={back} />
        <ErrorNote>{error}</ErrorNote>
      </>
    );
  if (!data)
    return (
      <>
        <AdminTopbar title="Cliente" action={back} />
        <div className="skeleton h-96" aria-busy="true" aria-label="Cargando la ficha del cliente" />
      </>
    );

  const { client: c } = data;
  const payments = data.movements.filter((m) => m.kind === "plan_mes");
  const withdrawals = data.movements.filter((m) => m.kind === "retiro");
  return (
    <>
      <AdminTopbar
        title={nameOf(c)}
        subtitle={`${c.email} · Cliente desde el ${formatDate(c.createdAt)} · ${data.lastLoginAt ? `Último ingreso: ${formatDateTime(data.lastLoginAt)}` : "Nunca ha entrado"}`}
        action={back}
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {!c.profile?.termsCurrent && <Status tone="wait">{c.profile ? "Falta completar los datos o aceptar los términos" : "No ha registrado sus datos personales"}</Status>}
        {c.openTransfers > 0 && <Status tone="act">{c.openTransfers === 1 ? "Transferencia por confirmar" : `${c.openTransfers} transferencias por confirmar`}</Status>}
        {c.reservedCop > 0 && <Status tone="act">{`Retiro por pagar: ${formatCop(c.reservedCop)}`}</Status>}
        {c.plans.some((p) => p.state === "en_revision") && <Status tone="act">Devolución por conciliar</Status>}
        {c.deletionRequest && <Status tone="act">Pidió eliminar su cuenta</Status>}
      </div>

      <dl className="mt-8 grid border-t border-line-strong sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Energía generada", `${formatNumber(c.generatedKwh)} kWh`],
          ["Venta de su energía", formatCop(c.soldCop)],
          ["Saldo disponible", formatCop(c.balanceCop)],
          ["Retiros por pagar", formatCop(c.reservedCop)],
          ["Retirado", formatCop(c.withdrawnCop)],
        ].map(([label, value]) => (
          <div key={label} className="border-b border-line py-5 pr-4">
            <dt className="cap">{label}</dt>
            <dd className="num mt-2 text-xl">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-14">
          <Block title="Planes" count={c.plans.length}>
            {c.plans.length ? (
              <ul>
                {c.plans.map((p) => {
                  const st = PLAN_STATE[p.state] ?? PLAN_STATE.borrador;
                  return (
                    <li key={p.id} className="border-b border-line py-5">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <span className="font-medium">{p.planName}</span>
                        <Status tone={st.tone}>{st.label}</Status>
                        <span className="num text-sm text-mute">
                          Mes {Math.min(p.paidMonths, p.months)} de {p.months}
                        </span>
                        <span className="num ml-auto text-xs text-dim">{p.id}</span>
                      </div>
                      <p className="num mt-2 text-sm text-mute">
                        {formatNumber(p.dailyKwh)} kWh al día · compra {formatCop(p.priceCopPerKwh)} / kWh · venta {formatCop(p.saleCopPerKwh)} / kWh · {formatNumber(p.generatedKwh)} kWh generados
                      </p>
                      <p className="mt-1 text-sm text-mute">
                        {p.periods.map((x) => `Mes ${x.index}: ${formatDate(x.startsAt)} al ${formatDate(x.endsAt)}`).join(" · ") || "Sin meses pagados"}
                        {p.state === "en_pausa" && p.graceEndsAt ? `. Puede pagar hasta el ${formatDate(p.graceEndsAt)}.` : ""}
                      </p>
                      {(p.state === "activa" || p.state === "en_pausa" || p.state === "en_revision") && (
                        <button type="button" className="link mt-2 text-sm text-fog" onClick={() => setClosing(p)}>
                          Cerrar el plan
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Todavía no ha comprado un plan.</Empty>
            )}
          </Block>

          <Block title="Pagos" count={payments.length} link={{ href: `/admin/pagos?cliente=${encodeURIComponent(c.id)}`, label: "Atenderlos en Pagos" }}>
            <Movements rows={payments} empty="No tiene pagos." />
          </Block>

          <Block title="Retiros" count={withdrawals.length} link={withdrawals.some((w) => w.status === "por_aprobar") ? { href: "/admin/retiros", label: "Pagarlos en Retiros" } : undefined}>
            <Movements rows={withdrawals} empty="No ha pedido retiros." />
          </Block>

          <Block title="Lo que hizo el equipo en esta cuenta" count={data.activity.length} link={{ href: "/admin/actividad", label: "Toda la actividad" }}>
            {data.activity.length ? (
              <ul>
                {data.activity.map((a) => (
                  <li key={a.id} className="grid gap-1 border-b border-line py-4 text-sm sm:grid-cols-[12.5rem_minmax(0,1fr)] sm:gap-6">
                    <span className="num whitespace-nowrap text-mute">{formatDateTime(a.createdAt)}</span>
                    <span>
                      <span className="cap mr-2">{actionLabel(a.action)}</span>
                      {a.summary} <span className="text-mute">por {a.actorName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nadie del equipo ha hecho cambios en esta cuenta.</Empty>
            )}
          </Block>
        </div>

        <aside className="min-w-0 space-y-12" aria-label="Acciones y datos del cliente">
          <section className="border border-line-strong p-6" aria-label="Acciones">
            <h2 className="cap">Acciones</h2>
            <div className="mt-4 flex flex-col items-start gap-3">
              <button type="button" className="btn btn-solid w-full" disabled={!c.profile?.termsCurrent} onClick={() => setPaying(true)} title={c.profile?.termsCurrent ? undefined : "El comercializador debe completar sus datos personales primero"}>
                Registrar un pago
              </button>
              {c.deletionRequest && (
                <>
                  <button type="button" className="btn btn-ghost w-full" disabled={c.deletionRequest.blockers.length > 0} onClick={() => setDeciding("eliminar")}>
                    Eliminar la cuenta
                  </button>
                  <button type="button" className="link text-sm" onClick={() => setDeciding("responder")}>
                    Responder la solicitud sin eliminar
                  </button>
                </>
              )}
              <a href={`mailto:${c.email}`} className="link text-sm">
                Escribirle a {c.email}
              </a>
            </div>
            {c.deletionRequest && (
              <div className="mt-5 border-t border-line pt-4 text-sm leading-relaxed">
                <p className="font-medium">
                  Pidió eliminar su cuenta el {formatDate(c.deletionRequest.createdAt)}. Responde antes del {formatDate(c.deletionRequest.dueAt)}.
                </p>
                {c.deletionRequest.reason && <p className="mt-1 text-fog">Motivo: {c.deletionRequest.reason}</p>}
                {c.deletionRequest.blockers.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-mute">
                    {c.deletionRequest.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <Block title="Datos personales">
            {c.profile ? (
              <dl className="space-y-3 text-sm">
                <Row label="Titular">{c.profile.fullName || "Sin registrar"}</Row>
                <Row label="Documento">{c.profile.docNumber ? `${c.profile.docType} ${c.profile.docNumber}` : "Sin registrar"}</Row>
                {c.profile.companyName && <Row label="Razón social">{c.profile.companyName}</Row>}
                {c.profile.nit && <Row label="NIT">{c.profile.nit}</Row>}
                <Row label="Celular">{c.profile.phone || "Sin registrar"}</Row>
                <Row label="Ciudad">{c.profile.city || "Sin registrar"}</Row>
                <Row label="Correo">{c.email}</Row>
                <Row label="Términos">{c.profile.termsAcceptedAt ? `${c.profile.termsCurrent ? "Vigentes" : "Versión anterior"}, aceptados el ${formatDate(c.profile.termsAcceptedAt)}` : "No los ha aceptado"}</Row>
              </dl>
            ) : (
              <Empty>No ha registrado sus datos personales.</Empty>
            )}
          </Block>

          <Block title="Acceso">
            <dl className="space-y-3 text-sm">
              <Row label="Último ingreso">{data.lastLoginAt ? formatDateTime(data.lastLoginAt) : "Nunca"}</Row>
              <Row label="Sesiones abiertas">{String(data.activeSessions)}</Row>
              <Row label="Wallet vinculada">{data.wallet ? `${data.wallet.walletName} ${shortAddress(data.wallet.address)}` : "Ninguna"}</Row>
            </dl>
          </Block>

          <Block title="Correos que le enviamos" count={data.emails.length}>
            {data.emails.length ? (
              <ul>
                {data.emails.map((e) => {
                  const st = EMAIL_STATUS[e.status] ?? EMAIL_STATUS.enviando;
                  return (
                    <li key={e.key} className="border-b border-line py-3 text-sm">
                      <p>{e.subject}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
                        <span className="num">{formatDateTime(e.at)}</span>
                        <Status tone={st.tone}>{st.label}</Status>
                        {e.error && <span>{e.error}</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Ninguno todavía. Los correos a los clientes se activan con un remitente de dominio propio (Configuración).</Empty>
            )}
          </Block>

          <Block title="Solicitudes sobre sus datos" count={data.requests.length}>
            {data.requests.length ? (
              <ul>
                {data.requests.map((r) => (
                  <li key={r.id} className="border-b border-line py-3 text-sm leading-relaxed">
                    <p>
                      Eliminar la cuenta · <span className="text-fog">{REQUEST_STATUS[r.status] ?? r.status}</span>
                    </p>
                    <p className="text-xs text-mute">
                      Pedida el {formatDate(r.createdAt)}
                      {r.resolvedAt ? `, respondida el ${formatDate(r.resolvedAt)}` : `, vence el ${formatDate(r.dueAt)}`}
                    </p>
                    {r.resolution && <p className="mt-1 text-xs text-fog">{r.resolution}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No ha hecho solicitudes.</Empty>
            )}
          </Block>
        </aside>
      </div>

      <ManualPaymentDialog client={paying ? c : null} onClose={() => setPaying(false)} listUrl={url} />
      <ClosePlanDialog plan={closing} onClose={() => setClosing(null)} listUrl={url} />
      <DataRequestDialog target={deciding ? { client: c, action: deciding } : null} onClose={() => setDeciding(null)} listUrl={url} />
    </>
  );
}

function Block({ title, count, link, children }: { title: string; count?: number; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-strong pb-3">
        <h2 className="text-lg font-medium">
          {title} {count != null && <span className="num text-mute">{count}</span>}
        </h2>
        {link && (
          <Link href={link.href} className="link text-sm">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-mute">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-5 text-sm text-mute">{children}</p>;
}

function Movements({ rows, empty }: { rows: Detail["movements"]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul>
      {rows.map((m) => {
        const st = TX_STATUS[m.status] ?? TX_STATUS.pendiente;
        const explorer = m.method === "crypto" ? explorerTxUrl(m) : null;
        const reference = m.providerId ?? m.txHash;
        return (
          <li key={m.id} className="grid gap-2 border-b border-line py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="num">{m.id}</span>
                <Status tone={st.tone}>{st.label}</Status>
                <span className="text-mute">{m.kind === "retiro" ? (m.bankName ? `A ${m.bankName} ••${m.bankAccountLast4 ?? ""}` : `A la wallet ${shortAddress(m.walletAddress)}`) : `${adminMethodLabel(m.method)}${m.periodIndex ? ` · mes ${m.periodIndex}` : ""}`}</span>
              </p>
              <p className="num mt-1 text-xs text-mute">
                {formatDateTime(m.createdAt)}
                {m.confirmedAt && m.status === "confirmada" ? ` · confirmado ${formatDateTime(m.confirmedAt)}` : ""}
                {reference ? ` · ref. ${reference}` : ""}
              </p>
              {m.note && <p className="mt-1 text-xs text-fog">{m.note}</p>}
              {explorer && (
                <a href={explorer} target="_blank" rel="noreferrer" className="link mt-1 inline-flex items-center gap-1 text-xs">
                  Ver en el explorador <ExternalLink size={11} strokeWidth={1.5} />
                </a>
              )}
            </div>
            <span className="num text-base sm:text-right">{m.kind === "retiro" ? `−${formatCop(m.amountCop)}` : formatCop(m.amountCop)}</span>
          </li>
        );
      })}
    </ul>
  );
}
