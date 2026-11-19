"use client";
import Link from "next/link";
import type { IntegrityReport } from "@/lib/admin/integrity";
import { useJson } from "@/lib/client/use-json";
import { formatDateTime } from "@/lib/format";
import { ErrorNote } from "@/components/ui/field";
import { Status } from "@/components/ui/status";

interface SystemStatus {
  version: string;
  environment: string;
  database: { latencyMs: number };
  cronConfigured: boolean;
  jobs: { id: string; label: string; every: string; lastRunAt: number | null }[];
  checkedAt: number;
}

const DAY_MS = 86_400_000;

/** «hace 3 min», «hace 5 h», «hace 2 días». */
function ago(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Versión publicada, base de datos y la última pasada de cada tarea automática. */
export function SystemStatusSection() {
  const { data, error } = useJson<SystemStatus>("/api/admin/system", { refreshMs: 60_000 });
  return (
    <section className="mt-16 border-t border-line-strong pt-8" aria-labelledby="system-title">
      <h2 id="system-title" className="text-xl font-medium">
        Estado del sistema
      </h2>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-mute">
        Las tareas automáticas confirman pagos aunque el aviso del proveedor se pierda, cierran lo abandonado y envían recordatorios. Para que te avisen si la página se cae, configura un monitor
        gratuito sobre /api/health (ver README).
      </p>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      {!data && !error && <div className="skeleton mt-6 h-40" aria-busy="true" aria-label="Cargando el estado del sistema" />}
      {data && (
        <dl className="mt-6 max-w-[860px]">
          <Item label="Versión publicada" status={<Status tone="ok">{data.environment === "production" ? "Producción" : data.environment === "preview" ? "Vista previa" : "Local"}</Status>}>
            {data.version}
          </Item>
          <Item label="Base de datos" status={<Status tone={data.database.latencyMs < 1500 ? "ok" : "wait"}>{data.database.latencyMs < 1500 ? "Responde" : "Lenta"}</Status>}>
            {`Respondió en ${data.database.latencyMs} ms.`}
          </Item>
          {data.jobs.map((j) => {
            // La pasada diaria y el cuadre dependen del cron de Vercel: sin CRON_SECRET no corren.
            const daily = j.id === "cron-payments" || j.id === "cuadre";
            const missing = daily && !data.cronConfigured;
            const late = daily && j.lastRunAt != null && data.checkedAt - j.lastRunAt > 1.2 * DAY_MS;
            const tone = missing || late ? "act" : j.lastRunAt == null ? "wait" : "ok";
            const label = missing ? "Sin configurar" : late ? "Atrasada" : j.lastRunAt == null ? "Sin pasadas" : "Al día";
            const text = missing
                ? `Falta CRON_SECRET: ${j.id === "cuadre" ? "el cuadre diario" : "la pasada diaria"} no corre.`
                : j.lastRunAt
                  ? `Última pasada ${ago(j.lastRunAt, data.checkedAt)} (${formatDateTime(j.lastRunAt)}).`
                  : "Todavía no ha corrido.";
            return (
              <Item key={j.id} label={j.label} status={<Status tone={tone}>{label}</Status>}>
                {text} <span className="text-mute">{j.every}</span>
              </Item>
            );
          })}
        </dl>
      )}
      <IntegrityChecks />
    </section>
  );
}

/** El cuadre en vivo: lo que no cuadra (no debería pasar nunca) y los pendientes que llevan días esperando. */
function IntegrityChecks() {
  const { data, error, loading, reload } = useJson<IntegrityReport>("/api/admin/integrity", { refreshMs: 5 * 60_000 });
  const summary = !data
    ? null
    : data.errors
      ? `${data.errors === 1 ? "Hay algo que no cuadra" : `Hay ${data.errors} cosas que no cuadran`}${data.warnings ? ` y ${data.warnings === 1 ? "un pendiente viejo" : `${data.warnings} pendientes viejos`}` : ""}.`
      : data.warnings
        ? `Todo cuadra. ${data.warnings === 1 ? "Hay un pendiente" : `Hay ${data.warnings} pendientes`} que lleva${data.warnings === 1 ? "" : "n"} días esperando.`
        : "Todo cuadra y no hay pendientes viejos.";
  return (
    <section className="mt-12" aria-labelledby="integrity-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="integrity-title" className="text-lg font-medium">
            Cuadre de los números
          </h3>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-mute">
            Revisa en los datos reales que cada pago tenga su mes de energía, que ningún saldo quede en negativo y que no haya pendientes olvidados. Corre solo cada día y, si algo
            no cuadra, les escribe a los propietarios.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void reload()} disabled={loading}>
          Revisar ahora
        </button>
      </div>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      {!data && !error && <div className="skeleton mt-6 h-40" aria-busy="true" aria-label="Revisando el cuadre" />}
      {data && (
        <>
          <p className="mt-6 text-sm" role="status">
            {summary} <span className="text-mute">Revisado el {formatDateTime(data.checkedAt)}</span>
          </p>
          <dl className="mt-4 max-w-[860px]">
            {data.checks.map((c) => (
              <Item
                key={c.id}
                label={c.title}
                status={
                  <Status tone={c.ok ? "ok" : c.level === "error" ? "act" : "wait"}>
                    {c.ok ? (c.level === "error" ? "Cuadra" : "Al día") : c.level === "error" ? "No cuadra" : "Pendiente"}
                  </Status>
                }
              >
                {c.detail}
                {!c.ok && c.items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.items.map((it) => (
                      <li key={`${it.href}-${it.label}`}>
                        <Link href={it.href} className="link">
                          {it.label}
                        </Link>
                      </li>
                    ))}
                    {c.count > c.items.length && <li className="text-mute">y {c.count - c.items.length} más.</li>}
                  </ul>
                )}
              </Item>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

function Item({ label, status, children }: { label: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-line py-4 text-sm sm:grid-cols-[15rem_8.5rem_minmax(0,1fr)] sm:gap-6">
      <dt className="font-medium">{label}</dt>
      <dd>{status}</dd>
      <dd className="leading-relaxed text-fog">{children}</dd>
    </div>
  );
}
