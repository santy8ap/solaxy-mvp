"use client";
import {
  ArrowUpRight,
  CircleUserRound,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/ingresar/actions";
import { formatClock, shortAddress } from "@/lib/format";
import { useClock } from "@/lib/client/use-clock";
import { useWallet } from "@/lib/wallet/context";
import { Logo } from "@/components/ui/logo";

export const NAV = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/planes", label: "Planes", icon: Zap },
  { href: "/panel/movimientos", label: "Movimientos", icon: FileText },
  { href: "/panel/billetera", label: "Billetera", icon: Wallet },
  { href: "/panel/perfil", label: "Mi cuenta", icon: CircleUserRound },
] as const;
function isActive(path: string, href: string) {
  return href === "/panel" ? path === "/panel" : path.startsWith(href);
}

export function Sidebar() {
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <aside className="panel-sidebar">
      <Link href="/" aria-label="In World Energy, inicio">
        <Logo />
      </Link>
      <div className="sidebar-label eyebrow">ESPACIO EMPRESARIAL</div>
      <nav aria-label="Panel">
        {NAV.map(({ href, label, icon: Icon }, index) => (
          <Link
            href={href}
            key={href}
            aria-current={isActive(path, href) ? "page" : undefined}
          >
            <Icon size={17} />
            <span>{label}</span>
            <span className="sidebar-index">0{index + 1}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link href="/admin">
          <ShieldCheck size={16} />
          Administración <ArrowUpRight size={13} />
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => signOut())}
        >
          <LogOut size={16} />
          {pending ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
        <span className="eyebrow">
          ENERGÍA SOLAR.
          <br />
          VISIÓN EMPRESARIAL.
        </span>
      </div>
    </aside>
  );
}
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="panel-bottom-nav" aria-label="Panel móvil">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(path, href) ? "page" : undefined}
        >
          <Icon size={19} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
export function WalletButton() {
  const wallet = useWallet();
  return wallet.status === "connected" ? (
    <button
      type="button"
      onClick={() => void wallet.disconnect()}
      className="btn btn-ghost"
      title="Desconectar wallet"
    >
      <span className="live-dot" />
      <span className="mono">{shortAddress(wallet.address)}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={wallet.openConnect}
      className="btn btn-ghost"
      disabled={wallet.status === "connecting"}
    >
      <Wallet size={15} />
      {wallet.status === "connecting" ? "Conectando…" : "Conectar wallet"}
    </button>
  );
}
export function Topbar({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const now = useClock();
  return (
    <header className="panel-topbar">
      <div>
        <Link
          href="/"
          className="panel-mobile-brand"
          aria-label="In World Energy, inicio"
        >
          <Logo />
        </Link>
        <span className="eyebrow">IN WORLD ENERGY / PANEL</span>
        <h1>{title ?? "Tu cuenta"}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar-actions">
        <div className="topbar-clock">
          <span className="eyebrow">HORA DE COLOMBIA</span>
          <span className="mono">{now ? formatClock(now) : "—:—:—"}</span>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}

export function AccountActions() {
  const [pending, start] = useTransition();
  return <div className="account-actions"><Link href="/admin" className="btn btn-ghost"><ShieldCheck size={15}/> Administración</Link><button type="button" className="btn btn-ghost" disabled={pending} onClick={() => start(() => signOut())}><LogOut size={15}/>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</button></div>;
}
