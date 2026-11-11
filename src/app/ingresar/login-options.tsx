"use client";
import { useActionState, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { planCheckoutHref, safeReturnTo } from "@/lib/navigation";
import { prepareGoogleLogin, signInDemo } from "./actions";

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5zM46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65zM10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19zM24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type Role = "user" | "admin";

const ROLES: { id: Role; title: string; note: string }[] = [
  {
    id: "user",
    title: "Comercializador",
    note: "Tus planes, tu energía y tus retiros",
  },
  { id: "admin", title: "Administrador", note: "Clientes, pagos y retiros" },
];

export function LoginOptions({
  googleEnabled,
  demoMode,
  testAdmin = false,
  defaultRole = "user",
  planId,
  returnTo,
}: {
  googleEnabled: boolean;
  demoMode: boolean;
  /** ¿La cuenta de pruebas puede administrar? Solo si su correo está en ADMIN_EMAILS. */
  testAdmin?: boolean;
  defaultRole?: Role;
  planId?: string;
  returnTo?: string;
}) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState(signInDemo, undefined);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onGoogle = async () => {
    setNotice(null);
    if (!googleEnabled) {
      setNotice(
        demoMode
          ? "El ingreso con Google todavía no está configurado en este equipo (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET). Mientras tanto, entra con la cuenta de pruebas."
          : "El ingreso con Google todavía no está configurado. Escríbenos para avisarnos.",
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
        setGoogleLoading(false);
        return;
      }
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL:
          role === "admin"
            ? "/api/admin/activar"
            : (safeReturnTo(returnTo) ??
              (planId ? planCheckoutHref(planId) : "/panel")),
      });
      if (error) {
        setGoogleLoading(false);
        setNotice(
          error.message ?? "No se pudo conectar con Google. Intenta de nuevo.",
        );
      }
    } catch {
      setGoogleLoading(false);
      setNotice(
        "No pudimos iniciar el ingreso. Revisa tu conexión e inténtalo de nuevo.",
      );
    }
  };

  const error = notice ?? state?.error ?? null;

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="cap mb-3">Entrar como</legend>
        <div className="grid grid-cols-2 border border-line-strong">
          {ROLES.map(({ id, title, note }) => {
            const active = role === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer flex-col gap-1 p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${id === "admin" ? "border-l border-line-strong" : ""} ${active ? "bg-ink text-void" : "hover:bg-ink/5"}`}
              >
                <input
                  type="radio"
                  name="role-choice"
                  value={id}
                  checked={active}
                  onChange={() => setRole(id)}
                  className="sr-only"
                />
                <span className="break-words font-medium">{title}</span>
                <span
                  className={`text-xs leading-snug ${active ? "text-void/70" : "text-mute"}`}
                >
                  {note}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {role === "admin" && (
        <div>
          <label htmlFor="admin-pin" className="cap">
            PIN de administrador
          </label>
          <input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
            className="field num mt-1 tracking-[0.4em]"
          />
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={onGoogle}
          disabled={googleLoading || pending}
          className="btn btn-solid w-full"
        >
          <GoogleG />
          {googleLoading ? "Abriendo Google…" : "Continuar con Google"}
        </button>
        {demoMode && (role !== "admin" || testAdmin) && (
          <form action={formAction}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="pin" value={pin} />
            <input type="hidden" name="plan" value={planId ?? ""} />
            <input
              type="hidden"
              name="next"
              value={safeReturnTo(returnTo) ?? ""}
            />
            <button
              type="submit"
              disabled={pending || googleLoading}
              className="btn btn-ghost w-full"
            >
              {pending
                ? "Entrando…"
                : role === "admin"
                  ? "Entrar como administrador de pruebas"
                  : "Entrar con la cuenta de pruebas"}
            </button>
          </form>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="border-l-2 border-ink pl-4 text-sm leading-relaxed text-fog"
        >
          {error}
        </p>
      )}
    </div>
  );
}
