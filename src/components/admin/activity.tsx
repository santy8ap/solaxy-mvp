"use client";
import { useJson } from "@/lib/client/use-json";
import { formatDateTime } from "@/lib/format";
import { AdminTopbar } from "./shell";
import { ACTION_LABEL, type AuditEntry } from "./types";

export function AdminActivity() {
  const { data, loading } = useJson<{ entries: AuditEntry[] }>("/api/admin/audit", { refreshMs: 15_000 });
  const entries = data?.entries ?? [];
  return (
    <>
      <AdminTopbar title="Actividad" subtitle="Todo lo que hicieron los administradores, en orden." />
      <section className="panel overflow-hidden" aria-label="Bitácora">
        <ul className="divide-y divide-silicon-600/40">
          {entries.map((a) => (
            <li key={a.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[170px_150px_1fr] sm:items-baseline sm:gap-4">
              <span className="num text-sm text-silver-500">{formatDateTime(a.createdAt)}</span>
              <span className="text-sm font-medium text-dusk-300">{ACTION_LABEL[a.action]}</span>
              <span className="text-sm text-silver-200">
                {a.summary} <span className="text-silver-500">por {a.actorName}</span>
              </span>
            </li>
          ))}
          {!loading && entries.length === 0 && <li className="px-5 py-10 text-center text-silver-400">Aún no hay actividad registrada.</li>}
        </ul>
      </section>
    </>
  );
}
