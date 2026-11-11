"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, Activity } from "lucide-react";
import type { PortfolioDTO } from "@/lib/portfolio";
import { useJson } from "@/lib/client/use-json";
import { formatCop, formatDateTime, formatNumber } from "@/lib/format";
import { useClock } from "@/lib/client/use-clock";
import { SunArc } from "@/components/landing/sun-arc";
import { PrivateAmount } from "@/components/ui/amount-privacy";
import { Odometer } from "@/components/ui/odometer";
import {
  DataError,
  DataSkeleton,
  EmptyState,
} from "@/components/ui/data-state";
import { DailyChart, GrowthChart } from "./charts";
import { Topbar } from "./shell";
import { Transactions } from "./transactions";

export function Overview() {
  const {
    data: p,
    error,
    reload,
  } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 30_000 });
  const now = useClock();
  return (
    <div className="panel-view">
      <Topbar
        title="Tu energía, en perspectiva."
        subtitle="Una visión clara de tu cuenta y su actividad."
      />
      {error && (
        <DataError
          message={error}
          stale={Boolean(p)}
          onRetry={() => void reload()}
        />
      )}
      {!p ? (
        !error && <DataSkeleton label="Cargando el resumen de tu cuenta" />
      ) : (
        <>
          <section className="account-hero" aria-labelledby="balance-title">
            <div className="account-balance">
              <span className="eyebrow">IN WORLD ENERGY / TU CUENTA</span>
              <h2 id="balance-title">SALDO DISPONIBLE</h2>
              <div className="balance-number">
                <PrivateAmount>
                  <Odometer
                    value={p.balanceCop}
                    decimals={2}
                    prefix="$ "
                    className="mono"
                  />
                </PrivateAmount>
              </div>
              <p>Pesos colombianos · Actualizado {formatDateTime(p.asOf)}</p>
              <Link href="/panel/billetera" className="text-link">
                Consultar billetera <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="account-plan">
              <span className="eyebrow">TU PRÓXIMO PASO</span>
              <span className="account-plan-mark" aria-hidden="true">
                ↗
              </span>
              <h3>Encuentra tu escala.</h3>
              <p>
                Explora los planes de energía para empresas y revisa los valores
                mensuales.
              </p>
              <Link className="btn btn-sun" href="/panel/planes">
                Explorar planes <ArrowRight size={15} />
              </Link>
            </div>
          </section>
          <dl className="account-metrics">
            {[
              [
                "Ingresos estimados hoy",
                formatCop(p.earnedTodayCop),
                "Según el modelo de producción",
              ],
              [
                "Energía acumulada estimada",
                `${formatNumber(p.energyKwh, 1)} kWh`,
                "Registrada para tu cuenta",
              ],
              [
                "Retiros realizados",
                formatCop(p.withdrawnCop),
                "Operaciones confirmadas",
              ],
              [
                "Solicitudes en revisión",
                formatCop(p.reservedCop),
                "Saldo reservado",
              ],
            ].map(([label, value, note]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {label.startsWith("Energía") ? (
                    value
                  ) : (
                    <PrivateAmount>{value}</PrivateAmount>
                  )}
                </dd>
                <span>{note}</span>
              </div>
            ))}
          </dl>
          <div className="account-grid">
            <section className="account-section" aria-labelledby="growth-title">
              <div className="account-section-heading">
                <div>
                  <span className="eyebrow">01 / EVOLUCIÓN</span>
                  <h2 id="growth-title">Ingresos acumulados</h2>
                </div>
                <Activity size={18} aria-hidden="true" />
              </div>
              <p className="section-note">
                Estimación del modelo · Hasta 90 días
              </p>
              {p.growth.length ? (
                <GrowthChart p={p} />
              ) : (
                <EmptyState
                  title="Aún no hay datos"
                  description="La evolución de tu cuenta aparecerá cuando exista actividad."
                />
              )}
            </section>
            <section className="account-section" aria-labelledby="daily-title">
              <div className="account-section-heading">
                <div>
                  <span className="eyebrow">02 / DÍA A DÍA</span>
                  <h2 id="daily-title">Ingresos diarios</h2>
                </div>
              </div>
              <p className="section-note">
                Estimación del modelo · Últimos 30 días
              </p>
              {p.daily.length ? (
                <DailyChart p={p} />
              ) : (
                <EmptyState
                  title="Tu actividad, día a día"
                  description="Aquí podrás consultar los ingresos registrados por fecha."
                />
              )}
            </section>
          </div>
        </>
      )}
      <section
        className="account-section"
        aria-labelledby="solar-summary-title"
      >
        <div className="account-section-heading">
          <div>
            <span className="eyebrow">03 / EL RITMO DEL SOL</span>
            <h2 id="solar-summary-title">Cada hora tiene su lugar.</h2>
          </div>
          <span className="section-note">06:00–19:00 · Colombia</span>
        </div>
        <SunArc now={now} reading={null} />
        <p className="section-note">
          Curva proyectada de referencia, sin conexión a medidores. No determina
          el saldo de tu cuenta.
        </p>
      </section>
      <section className="account-section" aria-labelledby="recent-title">
        <div className="account-section-heading">
          <div>
            <span className="eyebrow">04 / ACTIVIDAD</span>
            <h2 id="recent-title">Últimos movimientos</h2>
          </div>
          <Link href="/panel/movimientos" className="text-link">
            Ver todos <ArrowUpRight size={15} />
          </Link>
        </div>
        {p ? (
          <Transactions transactions={p.transactions} compact />
        ) : (
          <DataSkeleton label="Cargando movimientos" />
        )}
      </section>
    </div>
  );
}
