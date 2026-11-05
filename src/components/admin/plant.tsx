"use client";
import { useEffect, useMemo, useState } from "react";
import { refetch, useJson } from "@/lib/client/use-json";
import { useSettings } from "@/lib/client/use-settings";
import { formatCop, formatNumber, formatPct } from "@/lib/format";
import { econFrom, specFrom, validateSettings, type PlantSettings } from "@/lib/plant-settings";
import { dayProfile, localDayIndex } from "@/lib/sim";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import type { OverviewDTO } from "./types";
import { saveSettings } from "./withdrawals";

/** 120 días de referencia (deterministas) para estimar la rentabilidad con otros valores. */
const REFERENCE_LAST_DAY = localDayIndex(Date.UTC(2026, 10, 1, 17));

function estimate(s: PlantSettings) {
  const spec = specFrom(s);
  const econ = econFrom(s);
  let net = 0;
  for (let d = 0; d < 120; d++) net += dayProfile(spec, REFERENCE_LAST_DAY - d, econ).reduce((acc, i) => acc + i.netCop, 0);
  const perKwpYear = ((net / 120) * 365) / spec.capacityKwp;
  return { yieldEa: perKwpYear / s.pricePerKwCop, perKwMonth: perKwpYear / 12, paybackYears: s.pricePerKwCop / perKwpYear };
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-silver-300">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-silver-500">{hint}</p>}
    </div>
  );
}

export function AdminPlant() {
  const { settings, loaded, reload } = useSettings();
  // El formulario solo aparece con la configuración real cargada: así no se borra lo que se escribe.
  if (!loaded) {
    return (
      <>
        <AdminTopbar title="Planta" subtitle="Configura la planta y el modelo de negocio. Los cambios aplican de ahora en adelante." />
        <div className="h-[520px] animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/60" aria-busy="true" aria-label="Cargando configuración" />
      </>
    );
  }
  // Al guardar cambia updatedAt y el formulario arranca con los valores nuevos.
  return <PlantForm key={settings.updatedAt ?? 0} settings={settings} reload={reload} />;
}

function PlantForm({ settings, reload }: { settings: PlantSettings; reload(): Promise<void> }) {
  const { data: overview } = useJson<OverviewDTO>("/api/admin/overview");
  const [draft, setDraft] = useState<PlantSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(() => estimate(settings));

  // La estimación cuesta unos milisegundos: se recalcula poco después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!validateSettings(draft, { soldKw: 0 })) setPreview(estimate(draft));
    }, 250);
    return () => clearTimeout(t);
  }, [draft]);

  const current = useMemo(() => estimate(settings), [settings]);
  const soldKw = overview?.soldKw ?? 0;
  const problem = validateSettings(draft, { soldKw });
  const dirty = JSON.stringify({ ...draft, updatedAt: null }) !== JSON.stringify({ ...settings, updatedAt: null });
  const set = <K extends keyof PlantSettings>(k: K, v: PlantSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await saveSettings(draft);
      await reload();
      void refetch("/api/admin/overview");
      void refetch("/api/platform");
      toast("Cambios guardados. Aplican desde ahora; el historial no cambia.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const num = (k: keyof PlantSettings, step = 1) => (
    <input
      id={`f-${k}`}
      type="number"
      step={step}
      value={Number(draft[k])}
      onChange={(e) => set(k, Number(e.target.value) as never)}
      className="field"
    />
  );

  return (
    <>
      <AdminTopbar title="Planta" subtitle="Configura la planta y el modelo de negocio. Los cambios aplican de ahora en adelante." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-6 sm:p-8" aria-label="Configuración">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="f-name" label="Nombre de la planta">
              <input id="f-name" value={draft.name} onChange={(e) => set("name", e.target.value)} className="field" />
            </Field>
            <Field id="f-location" label="Ubicación">
              <input id="f-location" value={draft.location} onChange={(e) => set("location", e.target.value)} className="field" />
            </Field>
            <Field id="f-capacityKwp" label="Capacidad instalada (kWp)" hint={`Ya hay ${formatNumber(soldKw, 1)} kW vendidos; no puede quedar por debajo.`}>
              {num("capacityKwp", 10)}
            </Field>
            <Field id="f-pricePerKwCop" label="Precio por kW (COP)" hint="Aplica a las compras nuevas a la planta.">
              {num("pricePerKwCop", 50_000)}
            </Field>
            <Field id="f-tariffDayCop" label="Tarifa de día ($/kWh)" hint="Precio al que se vende la energía solar.">
              {num("tariffDayCop", 10)}
            </Field>
            <Field id="f-tariffPeakCop" label="Tarifa pico ($/kWh)" hint="De 6 a 10 p. m., cuando entrega la batería.">
              {num("tariffPeakCop", 10)}
            </Field>
            <Field id="f-commissionPct" label="Comisión de operación y plataforma (%)" hint={`Los inversionistas reciben el ${formatNumber(100 - (draft.commissionPct || 0), 1)} % del ingreso.`}>
              {num("commissionPct", 0.5)}
            </Field>
          </div>
          {problem && (
            <p role="alert" className="mt-5 rounded-xl border border-alert-400/40 bg-alert-400/10 p-3 text-sm text-alert-400">
              {problem}
            </p>
          )}
          <div className="mt-7 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={() => setDraft(settings)}>
              Descartar cambios
            </button>
            <button type="button" className="btn btn-dusk" disabled={!dirty || !!problem || busy} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </section>

        <aside className="panel cells p-6 sm:p-8" aria-label="Efecto de los cambios">
          <h2 className="text-lg font-semibold text-silver-50">Así quedaría para los inversionistas</h2>
          <p className="mt-1 text-sm text-silver-400">Estimación con la producción de 120 días del modelo.</p>
          <dl className="mt-6 space-y-5">
            {[
              ["Rentabilidad estimada", formatPct(preview.yieldEa), formatPct(current.yieldEa)],
              ["Ganancia por kW al mes", formatCop(preview.perKwMonth), formatCop(current.perKwMonth)],
              ["Recuperación de la inversión", `${formatNumber(preview.paybackYears, 1)} años`, `${formatNumber(current.paybackYears, 1)} años`],
            ].map(([k, v, now]) => (
              <div key={k}>
                <dt className="text-sm text-silver-400">{k}</dt>
                <dd className="num mt-1 text-2xl font-semibold text-silver-50">{v}</dd>
                {dirty && <dd className="num text-xs text-silver-500">Hoy: {now}</dd>}
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
