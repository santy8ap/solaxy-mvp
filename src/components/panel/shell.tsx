"use client";
import { ArrowLeftRight, Gauge, IdCard, LayoutDashboard, LogOut, MonitorPlay, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/ingresar/actions";
import { formatClock, shortAddress } from "@/lib/format";
import { useLive, useNow } from "@/lib/live/hooks";
import { useWallet } from "@/lib/wallet/context";
import { chainName } from "@/lib/wallet/types";
import { Logo } from "@/components/ui/logo";
import { useUser } from "./user-context";

export const NAV = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/telemetria", label: "Telemetría", icon: Gauge },
  { href: "/panel/mercado", label: "Mercado", icon: ArrowLeftRight },
  { href: "/panel/billetera", label: "Billetera", icon: Wallet },
  { href: "/panel/socios", label: "Socios", icon: Users },
] as const;

function isActive(path: string, href: string) {
  return href === "/panel" ? path === "/panel" : path.startsWith(href);
}

export function Sidebar() {
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-silicon-600/40 bg-silicon-950/40 px-4 py-6 lg:flex">
      <Link href="/" className="px-2" aria-label="Solaxy, inicio">
        <Logo />
      </Link>
      <nav className="mt-10 flex flex-col gap-1" aria-label="Panel">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors ${
                active ? "bg-silicon-700/80 font-semibold text-silver-50" : "text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
              }`}
            >
              <Icon size={18} className={active ? "text-sun-400" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <Link
          href="/panel/perfil"
          aria-current={path === "/panel/perfil" ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors ${
            path === "/panel/perfil" ? "bg-silicon-700/80 font-semibold text-silver-50" : "text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
          }`}
        >
          <IdCard size={18} className={path === "/panel/perfil" ? "text-sun-400" : ""} />
          Mis datos
        </Link>
        <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] text-silver-300 hover:bg-silicon-800 hover:text-silver-50">
          <ShieldCheck size={18} className="text-dusk-300" />
          Administración
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("solaxy:presenter"))}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
        >
          <MonitorPlay size={18} />
          Modo presentación
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => signOut())}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] text-silver-300 hover:bg-silicon-800 hover:text-silver-50"
        >
          <LogOut size={18} />
          {pending ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-silicon-600/50 bg-silicon-950/90 backdrop-blur-md lg:hidden" aria-label="Panel">
      <ul className="mx-auto grid max-w-[560px] grid-cols-5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[0.7rem] ${active ? "text-sun-300" : "text-silver-400"}`}
              >
                <Icon size={20} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function WalletButton() {
  const w = useWallet();
  if (w.status === "connected") {
    return (
      <button type="button" onClick={() => void w.disconnect()} className="btn btn-ghost !px-3.5 !py-2 text-sm" title="Desconectar wallet">
        <span className="h-2 w-2 rounded-full bg-leaf-400" />
        <span className="num">{shortAddress(w.address)}</span>
        <span className="hidden text-silver-400 sm:inline">{chainName(w.chainId)}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={w.openConnect} className="btn btn-sun !px-4 !py-2.5 text-sm">
      <Wallet size={16} />
      {w.status === "connecting" ? "Conectando…" : "Conectar wallet"}
    </button>
  );
}

export function Topbar({ title, subtitle }: { title?: string; subtitle?: string }) {
  const user = useUser();
  const live = useLive();
  const now = useNow(1000);
  const first = user.name.split(" ")[0];
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-semibold text-silver-50 sm:text-[1.7rem]" style={{ fontStretch: "112%" }}>
          {title ?? `Hola, ${first}`}
        </h1>
        <p className="mt-1 text-silver-400">{subtitle ?? "Así va tu energía en este momento."}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 text-sm text-silver-400 md:flex">
          <span className="live-dot" data-tone={live.status === "simulated" ? "sim" : live.status === "live" ? undefined : "off"} />
          <span className="num">{now ? formatClock(now) : ""}</span>
          {live.status === "simulated" && <span className="text-dusk-300">simulado</span>}
        </span>
        <WalletButton />
      </div>
    </header>
  );
}
