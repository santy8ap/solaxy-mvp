"use client";
import { KeyRound, LineChart } from "lucide-react";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ENERGY_PLANS, planSummary } from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
import { safeDestination } from "@/lib/navigation";
import { authClient } from "@/lib/auth-client";
import { prepareGoogleLogin, signInDemo } from "./actions";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#656565"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#7f7f7f"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#bcbcbc"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#898989"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type Role = "user" | "admin";

const ROLES: {
  id: Role;
  title: string;
  note: string;
  icon: typeof LineChart;
}[] = [
  {
    id: "user",
    title: "Mi cuenta",
    note: "Tu energía y movimientos",
    icon: LineChart,
  },
  {
    id: "admin",
    title: "Administrador",
    note: "Usuarios, planta y retiros",
    icon: KeyRound,
  },
];

export function LoginOptions({
  googleEnabled,
  demoMode,
  defaultRole = "user",
  destination = "/panel",
}: {
  googleEnabled: boolean;
  demoMode: boolean;
  defaultRole?: Role;
  destination?: string;
}) {
  const purchasePlan = ENERGY_PLANS.find((plan) => destination === `/comprar/${plan.id}`);
  const [role, setRole] = useState<Role>(purchasePlan ? "user" : defaultRole);
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState(signInDemo, undefined);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onGoogle = async () => {
    setNotice(null);
    if (!googleEnabled) {
      setNotice(
        demoMode
          ? "El ingreso con Google aún no está configurado en este equipo. Agrega GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (ver README). Mientras tanto, entra con la cuenta demo."
          : "El ingreso con Google aún no está configurado. El administrador debe agregar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.",
      );
      return;
    }
    if (role === "admin" && !pin.trim()) {
      setNotice("Escribe el PIN de administrador.");
      return;
    }
    setGoogleLoading(true);
    try {
      const prep = await prepareGoogleLogin(role, pin);
      if (prep?.error) {
        setNotice(prep.error);
        return;
      }
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL:
          role === "admin"
            ? "/api/admin/activar"
            : safeDestination(destination),
      });
      if (error)
        setNotice(
          error.message ??
            "No se pudo conectar con Google. Inténtalo de nuevo.",
        );
    } catch {
      setNotice(
        "No se pudo iniciar el ingreso. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const error = notice ?? state?.error ?? null;

  return (
    <div className="space-y-5">
      {purchasePlan && (
        <section className="login-plan-context" aria-label="Plan elegido para tu compra">
          <span className="eyebrow">TU SELECCIÓN SIGUE AQUÍ</span>
          <h3>Plan {purchasePlan.name}</h3>
          <p className="mono">{formatNumber(purchasePlan.daily)} kWh / día</p>
          <p className="login-plan-price mono">{formatCop(planSummary(purchasePlan).monthlyCop)} <span>COP / mes</span></p>
          <p>Inicia sesión y volverás directamente a este plan para continuar con tu compra.</p>
          <Link href={`/planes?plan=${purchasePlan.id}`} className="text-link">Cambiar plan ↗</Link>
        </section>
      )}
      {!purchasePlan && <fieldset>
        <legend className="mb-2.5 text-sm text-silver-400">Entrar como</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {ROLES.map(({ id, title, note, icon: Icon }) => {
            const active = role === id;
            return (
              <label
                key={id}
                className={`relative flex cursor-pointer flex-col gap-1.5 rounded-none border p-3.5 transition-all duration-200 ${
                  active
                    ? id === "admin"
                      ? "border-dusk-400/80 bg-dusk-400/10 shadow-[0_0_0_1px_rgb(153_153_153/0.35)]"
                      : "border-sun-400/80 bg-sun-400/10 shadow-[0_0_0_1px_rgb(188_188_188/0.35)]"
                    : "border-silicon-600/70 hover:border-silicon-500"
                }`}
              >
                <input
                  type="radio"
                  name="role-choice"
                  value={id}
                  checked={active}
                  onChange={() => setRole(id)}
                  className="sr-only"
                />
                <Icon
                  size={18}
                  className={
                    active
                      ? id === "admin"
                        ? "text-dusk-300"
                        : "text-sun-300"
                      : "text-silver-400"
                  }
                />
                <span className="font-semibold text-silver-50">{title}</span>
                <span className="text-xs leading-snug text-silver-400">
                  {note}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>}

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: role === "admin" ? "1fr" : "0fr",
          opacity: role === "admin" ? 1 : 0,
        }}
        aria-hidden={role !== "admin"}
      >
        <div className="overflow-hidden">
          <label htmlFor="admin-pin" className="text-sm text-silver-400">
            PIN de administrador
          </label>
          <input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            tabIndex={role === "admin" ? 0 : -1}
            placeholder="••••"
            className="field mt-2 tracking-[0.4em]"
          />
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onGoogle}
          disabled={!googleEnabled || googleLoading || pending}
          className="btn w-full !justify-center bg-silver-50 !py-3.5 text-silicon-950 hover:bg-white"
        >
          <GoogleG />
          {googleLoading ? "Abriendo Google…" : "Continuar con Google"}
        </button>
        {!googleEnabled && (
          <p className="section-note">
            El ingreso con Google no está disponible por el momento.
          </p>
        )}
        {demoMode && (
          <form action={formAction}>
            <input type="hidden" name="role" value={role} />
            <input
              type="hidden"
              name="next"
              value={safeDestination(destination)}
            />
            <input type="hidden" name="pin" value={pin} />
            <button
              type="submit"
              disabled={pending || googleLoading}
              className={`btn w-full !py-3.5 ${role === "admin" ? "btn-dusk" : "btn-sun"}`}
            >
              {pending
                ? "Entrando…"
                : role === "admin"
                  ? "Entrar como administrador (demo)"
                  : "Entrar con la cuenta demo"}
            </button>
          </form>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-none border border-sun-400/40 bg-sun-400/10 p-3 text-sm leading-relaxed text-sun-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
