"use client";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { useSettings } from "@/lib/client/use-settings";
import { formatCop, formatDateTime, formatKw, formatNumber } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/wallet/connect-dialog";
import { AdminTopbar } from "./shell";
import type { AdminUserRow } from "./types";

type Scope = "todos" | "reales" | "comunidad";
const SINCE = [
  { days: 0, label: "Hoy" },
  { days: 7, label: "Hace 7 días" },
  { days: 30, label: "Hace 30 días" },
  { days: 90, label: "Hace 90 días" },
] as const;

function AdjustDialog({ user, onClose, onDone }: { user: AdminUserRow | null; onClose(): void; onDone(): void }) {
  if (!user) return null;
  // La key reinicia el formulario cada vez que se abre para otro usuario.
  return <AdjustForm key={user.id} user={user} onClose={onClose} onDone={onDone} />;
}

function AdjustForm({ user, onClose, onDone }: { user: AdminUserRow; onClose(): void; onDone(): void }) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [value, setValue] = useState(1);
  const [since, setSince] = useState<0 | 7 | 30 | 90>(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const after = Math.max(0, Math.round((mode === "set" ? value : user.kw + value) * 10) / 10);
  const delta = Math.round((after - user.kw) * 10) / 10;
  const adding = delta > 0;

  const save = async () => {
    setBusy(true);
    try {
      await postJson(`/api/admin/users/${user.id}/kw`, { mode, kw: value, sinceDays: adding ? since : 0, reason });
      toast(`${user.name}: ${formatKw(user.kw, 1)} → ${formatKw(after, 1)}`);
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={`Ajustar kW de ${user.name}`}>
      <p className="text-sm text-silver-400">
        Hoy tiene <span className="num font-semibold text-silver-100">{formatKw(user.kw, 1)}</span>. Precio actual {formatCop(settings.pricePerKwCop)} por kW.
      </p>
      <div className="mt-5 inline-flex rounded-full border border-silicon-600/70 bg-silicon-950/50 p-1" role="tablist" aria-label="Tipo de ajuste">
        {(
          [
            ["delta", "Sumar o restar"],
            ["set", "Fijar total"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id);
              setValue(id === "set" ? user.kw : 1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm ${mode === id ? "bg-dusk-500/30 font-semibold text-silver-50" : "text-silver-300"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <label htmlFor="adj-kw" className="mt-5 block text-sm text-silver-400">
        {mode === "set" ? "Nuevo total de kW" : "kW a sumar (usa negativo para restar)"}
      </label>
      <input id="adj-kw" type="number" step={0.1} value={value} onChange={(e) => setValue(Number(e.target.value))} className="field mt-2" />
      {mode === "delta" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {[-1, 1, 5, 10].map((v) => (
            <button key={v} type="button" onClick={() => setValue(v)} className="num rounded-full border border-silicon-600 px-3 py-1 text-xs text-silver-300 hover:border-dusk-400/60 hover:text-silver-50">
              {v > 0 ? `+${v}` : v} kW
            </button>
          ))}
        </div>
      )}

      {adding && (
        <fieldset className="mt-5">
          <legend className="text-sm text-silver-400">¿Desde cuándo cuentan?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SINCE.map((s) => (
              <button
                key={s.days}
                type="button"
                aria-pressed={since === s.days}
                onClick={() => setSince(s.days)}
                className={`rounded-none border px-2 py-2 text-sm ${since === s.days ? "border-dusk-400/70 bg-dusk-400/10 text-silver-50" : "border-silicon-600/70 text-silver-300"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-silver-500">Si cuentan desde antes, el usuario verá de inmediato las ganancias de esos días.</p>
        </fieldset>
      )}

      <label htmlFor="adj-reason" className="mt-5 block text-sm text-silver-400">
        Motivo (lo verá el usuario en su historial)
      </label>
      <input id="adj-reason" type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: compra por transferencia, bono de bienvenida" className="field mt-2" />

      <div className="mt-6 rounded-none border border-silicon-600/60 bg-silicon-950/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-silver-400">Resultado</span>
          <span className="num font-semibold text-silver-50">
            {formatKw(user.kw, 1)} → {formatKw(after, 1)}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-silver-400">Cambio</span>
          <span className={`num font-semibold ${delta > 0 ? "text-leaf-300" : delta < 0 ? "text-alert-400" : "text-silver-300"}`}>
            {delta > 0 ? "+" : ""}
            {formatKw(delta, 1)} {delta !== 0 && `(${formatCop(Math.abs(delta) * settings.pricePerKwCop)})`}
          </span>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn btn-dusk" onClick={() => void save()} disabled={busy || delta === 0}>
          {busy ? "Guardando…" : "Guardar ajuste"}
        </button>
      </div>
    </Modal>
  );
}

function ProfileCell({ profile, real }: { profile: AdminUserRow["profile"]; real: boolean }) {
  if (!profile) return <span className="text-xs text-silver-500">{real ? "Sin datos todavía" : "—"}</span>;
  return (
    <div className="text-xs leading-relaxed">
      <div className="num text-silver-200">
        {profile.docType} {profile.docNumber}
      </div>
      <div className="num text-silver-400">
        {profile.phone} · {profile.city}
      </div>
      <div className={profile.termsCurrent ? "text-leaf-300" : "text-sun-300"}>
        {profile.termsCurrent ? `Términos aceptados ${profile.termsAcceptedAt ? formatDateTime(profile.termsAcceptedAt) : ""}` : "Falta aceptar los términos nuevos"}
      </div>
    </div>
  );
}

export function AdminUsers() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [scope, setScope] = useState<Scope>("reales");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const url = useMemo(() => `/api/admin/users?scope=${scope}&q=${encodeURIComponent(debounced)}`, [scope, debounced]);
  const { data, loading } = useJson<{ users: AdminUserRow[] }>(url);
  const users = data?.users ?? [];

  return (
    <>
      <AdminTopbar title="Usuarios" subtitle="Busca a cualquier persona y decide cuántos kW tiene." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Buscar por nombre o correo</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-silver-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o correo" className="field !pl-10" />
        </label>
        <div className="inline-flex rounded-full border border-silicon-600/70 bg-silicon-950/50 p-1" role="tablist" aria-label="Tipo de cuenta">
          {(
            [
              ["reales", "Cuentas reales"],
              ["comunidad", "Comunidad"],
              ["todos", "Todos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={scope === id}
              onClick={() => setScope(id)}
              className={`rounded-full px-4 py-2 text-sm ${scope === id ? "bg-dusk-500/30 font-semibold text-silver-50" : "text-silver-300 hover:text-silver-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="panel overflow-hidden" aria-label="Lista de usuarios">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="text-silver-400">
              <tr className="border-b border-silicon-600/50">
                <th className="px-5 py-3.5 font-normal">Usuario</th>
                <th className="px-3 py-3.5 font-normal">kW</th>
                <th className="px-3 py-3.5 font-normal">Invertido</th>
                <th className="px-3 py-3.5 font-normal">Ganancias</th>
                <th className="px-3 py-3.5 font-normal">Datos de inversionista</th>
                <th className="px-3 py-3.5 font-normal">Última actividad</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-silicon-600/40">
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-silicon-800/40">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-silver-50">{u.name}</div>
                    <div className="text-xs text-silver-500">{u.real ? u.email : "Inversionista de la comunidad (demo)"}</div>
                  </td>
                  <td className="num px-3 py-3.5 font-semibold text-silver-50">{formatNumber(u.kw, 1)}</td>
                  <td className="num px-3 py-3.5 text-silver-200">{formatCop(u.investedCop)}</td>
                  <td className="num px-3 py-3.5 text-leaf-300">{formatCop(u.earnedCop)}</td>
                  <td className="px-3 py-3.5">
                    <ProfileCell profile={u.profile} real={u.real} />
                  </td>
                  <td className="num px-3 py-3.5 text-silver-400">{u.lastActivity ? formatDateTime(u.lastActivity) : "—"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button type="button" className="btn btn-ghost !px-4 !py-2 text-sm" onClick={() => setEditing(u)}>
                      Ajustar kW
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-silver-400">
                    {debounced ? `Nadie coincide con “${debounced}”.` : "No hay usuarios en esta lista. Las cuentas reales aparecen cuando alguien entra con Google o con la cuenta demo."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-silicon-600/40 px-5 py-3 text-xs text-silver-500">{data ? `${formatNumber(users.length)} usuarios` : "Cargando…"}</p>
      </section>

      <AdjustDialog
        user={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          void refetch(url);
          void refetch("/api/admin/overview");
        }}
      />
    </>
  );
}
