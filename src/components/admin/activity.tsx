"use client";
import { useState } from "react";
import { useJson } from "@/lib/client/use-json";
import { formatDateTime } from "@/lib/format";
import { AdminTopbar } from "./shell";
import { ACTION_OPTIONS, actionLabel, type AuditEntry } from "./types";

export function AuditList({ entries }: { entries: AuditEntry[] }) {
  return (
    <ul>
      {entries.map((a) => (
        <li key={a.id} className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[12.5rem_11rem_minmax(0,1fr)] sm:items-baseline">
          <span className="num whitespace-nowrap text-sm text-mute">{formatDateTime(a.createdAt)}</span>
          <span className="cap break-words !text-fog">{actionLabel(a.action)}</span>
          <span className="text-sm leading-relaxed">
            {a.summary} <span className="text-mute">por {a.actorName}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const PAGE = 100;

export function AdminActivity() {
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const qs = new URLSearchParams({ limite: String(limit), ...(action && { accion: action }), ...(search && { q: search }) }).toString();
  const { data, loading } = useJson<{ entries: AuditEntry[] }>(`/api/admin/audit?${qs}`, { refreshMs: 15_000 });
  const entries = data?.entries ?? [];
  return (
    <>
      <AdminTopbar title="Actividad" subtitle="Lo que hicieron los administradores y lo que registró el sistema (por ejemplo, las devoluciones de Mercado Pago), de lo más reciente a lo más antiguo." />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 pb-6">
        <div>
          <label htmlFor="audit-action" className="cap">
            Tipo
          </label>
          <select
            id="audit-action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setLimit(PAGE);
            }}
            className="field !w-auto"
          >
            <option value="">Todas las acciones</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <form
          role="search"
          className="flex min-w-[240px] flex-1 items-end gap-3 sm:max-w-[420px]"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
            setLimit(PAGE);
          }}
        >
          <div className="flex-1">
            <label htmlFor="audit-q" className="cap">
              Buscar
            </label>
            <input id="audit-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Cliente, orden o administrador" className="field" />
          </div>
          <button type="submit" className="btn btn-ghost">
            Buscar
          </button>
        </form>
      </div>
      <section className="border-t border-line-strong" aria-label="Bitácora">
        <AuditList entries={entries} />
        {!loading && entries.length === 0 && <p className="py-10 text-mute">{action || search ? "Nada coincide con ese filtro." : "Todavía no hay actividad registrada."}</p>}
        {entries.length === limit && limit < 500 && (
          <button type="button" className="btn btn-ghost mt-8" onClick={() => setLimit((l) => Math.min(500, l + PAGE))}>
            Ver más
          </button>
        )}
      </section>
    </>
  );
}
