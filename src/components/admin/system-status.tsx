"use client";
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
            const missing = j.id === "cron-payments" && !data.cronConfigured;
            const late = j.id === "cron-payments" && j.lastRunAt != null && data.checkedAt - j.lastRunAt > 1.2 * DAY_MS;
            const tone = missing || late ? "act" : j.lastRunAt == null ? "wait" : "ok";
            const label = missing ? "Sin configurar" : late ? "Atrasada" : j.lastRunAt == null ? "Sin pasadas" : "Al día";
            const text = missing
                ? "Falta CRON_SECRET: la pasada diaria no corre."
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
