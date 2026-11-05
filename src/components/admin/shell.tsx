"use client";
import { ArrowLeftCircle, Banknote, Factory, History, LayoutGrid, LogOut, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useTransition } from "react";
import { becomeAdmin, leaveAdmin, signOut } from "@/app/ingresar/actions";
import { useJson } from "@/lib/client/use-json";
import { formatClock } from "@/lib/format";
import { useNow } from "@/lib/live/hooks";
import { Logo } from "@/components/ui/logo";

export const ADMIN_NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutGrid },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/retiros", label: "Retiros", icon: Banknote },
  { href: "/admin/planta", label: "Planta", icon: Factory },
  { href: "/admin/actividad", label: "Actividad", icon: History },
] as const;

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

function usePending() {
  const { data } = useJson<{ pendingWithdrawals: number }>("/api/admin/overview", { refreshMs: 10_000 });
  return data?.pendingWithdrawals ?? 0;
}

export function AdminSidebar() {
  const path = usePathname();
  const pending = usePending();
  const [leaving, startLeave] = useTransition();
  const [out, startOut] = useTransition();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-dusk-500/25 bg-silicon-950/50 px-4 py-6 lg:flex">
      <Link href="/" className="px-2" aria-label="Solaxy, inicio">
        <Logo />
      </Link>
      <span className="mx-2 mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-dusk-400/40 bg-dusk-400/10 px-2.5 py-1 text-xs font-medium text-dusk-300">
        <ShieldCheck size={13} /> Modo administrador
      </span>
      <nav className="mt-8 flex flex-col gap-1" aria-label="Administración">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors ${
                active ? "bg-dusk-500/20 font-semibold text-silver-50" : "text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
              }`}
            >
              <Icon size={18} className={active ? "text-dusk-300" : ""} />
              {label}
              {href === "/admin/retiros" && pending > 0 && (
                <span className="num ml-auto rounded-full bg-dusk-400 px-2 py-0.5 text-xs font-bold text-silicon-950">{pending}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <Link href="/panel" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] text-silver-300 hover:bg-silicon-800 hover:text-silver-50">
          <ArrowLeftCircle size={18} />
          Ver como inversionista
        </Link>
        <button
          type="button"
          disabled={leaving}
          onClick={() => startLeave(() => leaveAdmin())}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.95rem] text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
        >
          <ShieldCheck size={18} />
          {leaving ? "Saliendo…" : "Salir del modo admin"}
        </button>
        <button
          type="button"
          disabled={out}
          onClick={() => startOut(() => signOut())}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.95rem] text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
        >
          <LogOut size={18} />
          {out ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}

export function AdminBottomNav() {
  const path = usePathname();
  const pending = usePending();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-dusk-500/30 bg-silicon-950/90 backdrop-blur-md lg:hidden" aria-label="Administración">
      <ul className="mx-auto grid max-w-[560px] grid-cols-5">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 text-[0.7rem] ${active ? "text-dusk-300" : "text-silver-400"}`}>
                <Icon size={20} />
                {label}
                {href === "/admin/retiros" && pending > 0 && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-dusk-400" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminTopbar({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  const now = useNow(1000);
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-dusk-400/40 bg-dusk-400/10 px-2.5 py-1 text-xs font-medium text-dusk-300 lg:hidden">
          <ShieldCheck size={13} /> Modo administrador
        </span>
        <h1 className="text-2xl font-semibold text-silver-50 sm:text-[1.7rem]" style={{ fontStretch: "112%" }}>
          {title}
        </h1>
        <p className="mt-1 text-silver-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="num hidden text-sm text-silver-400 md:inline">{now ? formatClock(now) : ""}</span>
        {action}
      </div>
    </header>
  );
}

/** Se muestra si alguien con sesión abre /admin sin haber ingresado el PIN. */
export function AdminPinWall({ name }: { name: string }) {
  const [state, action, pending] = useActionState(becomeAdmin, undefined);
  return (
    <div className="mx-auto mt-16 max-w-[420px]">
      <div className="panel p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dusk-400/15 text-dusk-300">
          <ShieldCheck size={24} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-silver-50">Entrar como administrador</h1>
        <p className="mt-2 text-silver-400">Hola, {name.split(" ")[0]}. Escribe el PIN de administrador para continuar.</p>
        <form action={action} className="mt-6 space-y-4">
          <input name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus placeholder="••••" aria-label="PIN de administrador" className="field tracking-[0.4em]" />
          <button type="submit" disabled={pending} className="btn btn-dusk w-full">
            {pending ? "Verificando…" : "Entrar al panel de administración"}
          </button>
          {state?.error && (
            <p role="alert" className="text-sm text-alert-400">
              {state.error}
            </p>
          )}
        </form>
        <Link href="/panel" className="mt-6 inline-block text-sm text-silver-400 hover:text-silver-50">
          Volver a mi panel de inversionista
        </Link>
      </div>
    </div>
  );
}
