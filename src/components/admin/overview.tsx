"use client";
import { Banknote, Factory, Users } from "lucide-react";
import Link from "next/link";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatCopCompact, formatDateTime, formatNumber, formatPct } from "@/lib/format";
import { AdminTopbar } from "./shell";
import { ACTION_LABEL, type OverviewDTO } from "./types";

export function AdminOverview() {
  const { data: d, error } = useJson<OverviewDTO>("/api/admin/overview", { refreshMs: 10_000 });
  const sold = d ? d.soldKw / d.capacityKwp : 0;

  return (
    <>
      <AdminTopbar title="Administración" subtitle="Cómo va Solaxy y qué necesita tu atención." />
      {error && !d && <div className="panel p-6 text-alert-400">{error}</div>}

      <section className="grid overflow-hidden rounded-[var(--radius-panel)] border border-silicon-600/50 bg-silicon-600/50 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }} aria-label="Indicadores">
        <div className="bg-silicon-850 p-5">
          <div className="text-sm text-silver-400">Capital invertido</div>
          <div className="num mt-2 text-2xl font-semibold text-silver-50">{d ? formatCopCompact(d.capitalCop) : "—"}</div>
          <div className="mt-1 text-sm text-silver-500">{d ? `${formatNumber(d.investors)} inversionistas` : ""}</div>
        </div>
        <div className="bg-silicon-850 p-5">
          <div className="text-sm text-silver-400">kW vendidos</div>
          <div className="num mt-2 text-2xl font-semibold text-silver-50">{d ? `${formatNumber(d.soldKw, 1)} kW` : "—"}</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-silicon-700" aria-hidden="true">
            <div className="h-full rounded-full bg-gradient-to-r from-sun-500 to-sun-300 transition-[width] duration-700" style={{ width: `${sold * 100}%` }} />
          </div>
          <div className="mt-1.5 text-sm text-silver-500">{d ? `${formatPct(sold, 0)} de ${formatNumber(d.capacityKwp)} kWp` : ""}</div>
        </div>
        <div className="bg-silicon-850 p-5">
          <div className="text-sm text-silver-400">Precio por kW</div>
          <div className="num mt-2 text-2xl font-semibold text-silver-50">{d ? formatCop(d.settings.pricePerKwCop) : "—"}</div>
          <div className="mt-1 text-sm text-silver-500">{d ? `comisión ${formatNumber(d.settings.commissionPct, 1)} %` : ""}</div>
        </div>
        <Link href="/admin/retiros" className="group bg-silicon-850 p-5 transition-colors hover:bg-silicon-800">
          <div className="text-sm text-silver-400">Retiros por aprobar</div>
          <div className={`num mt-2 text-2xl font-semibold ${d?.pendingWithdrawals ? "text-dusk-300" : "text-silver-50"}`}>{d ? formatNumber(d.pendingWithdrawals) : "—"}</div>
          <div className="mt-1 text-sm text-silver-500 group-hover:text-silver-300">{d?.pendingWithdrawals ? `${formatCop(d.pendingWithdrawalsCop)} en espera` : "Nada pendiente"}</div>
        </Link>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <section className="panel p-6" aria-labelledby="quick-title">
          <h2 id="quick-title" className="text-lg font-semibold text-silver-50">
            Acciones rápidas
          </h2>
          <ul className="mt-4 space-y-2">
            {[
              { href: "/admin/usuarios", icon: Users, title: "Asignar o quitar kW", note: "Busca a un usuario y ajusta su participación" },
              { href: "/admin/retiros", icon: Banknote, title: "Revisar retiros", note: d?.settings.withdrawalApproval ? "La aprobación manual está activa" : "Los retiros se aprueban solos" },
              { href: "/admin/planta", icon: Factory, title: "Configurar la planta", note: "Capacidad, precio, tarifas y comisión" },
            ].map(({ href, icon: Icon, title, note }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-4 rounded-2xl border border-silicon-600/60 p-4 transition-colors hover:border-dusk-400/60 hover:bg-silicon-800/60">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusk-400/12 text-dusk-300">
                    <Icon size={19} />
                  </span>
                  <span>
                    <span className="block font-semibold text-silver-50">{title}</span>
                    <span className="block text-sm text-silver-400">{note}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {d && (
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-silicon-600/50 pt-5 text-sm">
              <div>
                <dt className="text-silver-400">Tarifa de día</dt>
                <dd className="num mt-0.5 font-semibold text-silver-100">{formatCop(d.settings.tariffDayCop)}/kWh</dd>
              </div>
              <div>
                <dt className="text-silver-400">Tarifa pico</dt>
                <dd className="num mt-0.5 font-semibold text-silver-100">{formatCop(d.settings.tariffPeakCop)}/kWh</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="panel p-6" aria-labelledby="recent-title">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-title" className="text-lg font-semibold text-silver-50">
              Últimos cambios
            </h2>
            <Link href="/admin/actividad" className="text-sm text-dusk-300 hover:text-dusk-300/80">
              Ver toda la actividad
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-silicon-600/40">
            {(d?.recent ?? []).map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-dusk-300">{ACTION_LABEL[a.action]}</span>
                  <span className="num text-xs text-silver-500">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-silver-200">{a.summary}</p>
                <p className="text-xs text-silver-500">por {a.actorName}</p>
              </li>
            ))}
            {d && d.recent.length === 0 && <li className="py-8 text-center text-silver-400">Todavía no hay cambios. Empieza ajustando los kW de un usuario.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
