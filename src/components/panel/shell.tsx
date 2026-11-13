"use client";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  LifeBuoy,
  UserRound,
  ShieldCheck,
  SunMedium,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/ingresar/actions";
import { BRAND } from "@/config/brand";
import { useAppConfig } from "@/lib/client/use-app-config";
import { usePlantNow } from "@/lib/client/use-catalog";
import { formatClock } from "@/lib/format";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { useUser } from "./user-context";
import { NotificationsLink } from "./notifications-link";

export const NAV = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/planes", label: "Planes", icon: SunMedium },
  { href: "/panel/billetera", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/panel/perfil", label: "Comercializador", icon: UserRound },
] as const;

function isActive(path: string, href: string) {
  return href === "/panel" ? path === "/panel" : path.startsWith(href);
}

const itemClass = (active: boolean) =>
  `flex items-center gap-3.5 border-l-2 py-3 pl-6 pr-4 text-[0.95rem] transition-colors ${active ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`;

export function Sidebar() {
  const path = usePathname();
  const user = useUser();
  const [pending, start] = useTransition();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line py-7 lg:flex">
      <Link href="/" className="px-6" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <nav className="mt-12 flex flex-col" aria-label="Panel">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              <Icon size={17} strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col border-t border-line pt-4">
        <Link href="/panel/perfil" className="mb-2 flex items-center gap-3 px-6 py-2 hover:opacity-80" aria-label={`Mis datos, ${user.name}`}>
          <Avatar name={user.name} image={user.image} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">{user.name}</span>
            <span className="block truncate text-xs text-mute">{user.email}</span>
          </span>
        </Link>
        <Link href="/ayuda" className={itemClass(false)}>
          <LifeBuoy size={17} /> Centro de ayuda
        </Link>
        {user.canAdmin && (
          <Link href="/admin" className={itemClass(false)}>
            <ShieldCheck size={17} strokeWidth={1.5} />
            Administración
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => signOut())}
          className={`${itemClass(false)} text-left`}
        >
          <LogOut size={17} strokeWidth={1.5} />
          {pending ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-void/95 backdrop-blur-md lg:hidden"
      aria-label="Panel"
    >
      <ul className="mx-auto grid max-w-[560px] grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1.5 border-t-2 pb-2.5 pt-2.5 text-[0.68rem] ${active ? "border-ink text-ink" : "border-transparent text-mute"}`}
              >
                <Icon size={19} strokeWidth={1.5} />
                <span className="max-w-full break-words px-1 text-center">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** En celular no hay barra lateral: la marca y la salida van arriba. */
export function MobileBar() {
  const user = useUser();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-4 lg:hidden">
      <Link href="/" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <div className="flex items-center gap-2 text-sm text-mute sm:gap-4">
        <Link href="/panel/perfil" aria-label={`Mis datos, ${user.name}`} className="hover:opacity-80">
          <Avatar name={user.name} image={user.image} size={26} />
        </Link>
        <NotificationsLink />
        {user.canAdmin && (
          <Link href="/admin" className="hover:text-ink">
            Admin
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => signOut())}
          className="hover:text-ink"
        >
          {pending ? "Saliendo…" : "Salir"}
        </button>
        <ThemeSelector />
      </div>
    </div>
  );
}

/** Indica que está habilitada la opción de pago de prueba. */
export function TestModeBar() {
  const { config } = useAppConfig();
  if (!config?.demoMode) return null;
  return (
    <p className="border-b border-line bg-ink px-4 py-1.5 text-center text-xs font-medium text-void">
      Pago de prueba habilitado. Consulta el medio de cada pago en Movimientos.
    </p>
  );
}

export function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const now = usePlantNow(1000);
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-8">
      <div>
        <h1 className="display text-[clamp(2.75rem,6vw,4.25rem)]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-[60ch] text-fog">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/ayuda" className="link text-sm text-mute">
          Ayuda
        </Link>
        <span className="hidden lg:block">
          <NotificationsLink />
        </span>
        <p
          className="flex items-center gap-3 text-sm text-mute"
          aria-label="Hora en la planta"
        >
          <span className="live-dot" />
          <span className="num">{now ? formatClock(now) : " "}</span>
        </p>
        <div className="hidden lg:block">
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
