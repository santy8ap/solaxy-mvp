"use client";
import { useJson } from "@/lib/client/use-json";
import { formatDateTime } from "@/lib/format";
import { AdminTopbar } from "./shell";
import { actionLabel, type AuditEntry } from "./types";

export function AuditList({ entries }: { entries: AuditEntry[] }) {
  return (
    <ul>
      {entries.map((a) => (
        <li key={a.id} className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[10.5rem_10rem_minmax(0,1fr)] sm:items-baseline">
          <span className="num text-sm text-mute">{formatDateTime(a.createdAt)}</span>
          <span className="cap !text-fog">{actionLabel(a.action)}</span>
          <span className="text-sm leading-relaxed">
            {a.summary} <span className="text-mute">por {a.actorName}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AdminActivity() {
  const { data, loading } = useJson<{ entries: AuditEntry[] }>("/api/admin/audit", { refreshMs: 15_000 });
  const entries = data?.entries ?? [];
  return (
    <>
      <AdminTopbar title="Actividad" subtitle="Todo lo que hicieron los administradores, de lo más reciente a lo más antiguo." />
      <section className="border-t border-line-strong" aria-label="Bitácora">
        <AuditList entries={entries} />
        {!loading && entries.length === 0 && <p className="py-10 text-mute">Todavía no hay actividad registrada.</p>}
      </section>
    </>
  );
}
