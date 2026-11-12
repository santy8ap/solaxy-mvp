"use client";
import { ArrowLeftCircle, Banknote, Building2, ChartColumn, CreditCard, Ellipsis, History, LayoutGrid, LogOut, Settings2, ShieldCheck, SunMedium } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { becomeAdmin, leaveAdmin, signOut } from "@/app/ingresar/actions";
import { BRAND } from "@/config/brand";
import { useJson } from "@/lib/client/use-json";
import { usePlantNow } from "@/lib/client/use-catalog";
import { formatClock } from "@/lib/format";
import { ErrorNote } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";

export const ADMIN_NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutGrid },
  { href: "/admin/analisis", label: "Análisis", icon: ChartColumn },
  { href: "/admin/clientes", label: "Clientes", icon: Building2 },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/retiros", label: "Retiros", icon: Banknote },
  { href: "/admin/planta", label: "Planta", icon: SunMedium },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings2 },
  { href: "/admin/actividad", label: "Actividad", icon: History },
] as const;

/** En celular caben cinco: las cuatro de todos los días y «Más» con el resto. */
const MOBILE_MAIN = new Set(["/admin", "/admin/clientes", "/admin/pagos", "/admin/retiros"]);

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

/** Cuántas cosas esperan al administrador: retiros por revisar, transferencias por confirmar y pagos por reembolsar. */
function usePending() {
  const { data } = useJson<{ pendingWithdrawals: number; paymentsToRefund: number; transfersToConfirm?: number }>("/api/admin/overview", { refreshMs: 15_000 });
  return { retiros: data?.pendingWithdrawals ?? 0, pagos: (data?.paymentsToRefund ?? 0) + (data?.transfersToConfirm ?? 0) };
}

const itemClass = (active: boolean) =>
  `flex items-center gap-3.5 border-l-2 py-3 pl-6 pr-4 text-[0.95rem] transition-colors ${active ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`;

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="num ml-auto bg-ink px-1.5 py-0.5 text-xs font-medium text-void">{n}</span>;
}

export function AdminSidebar() {
  const path = usePathname();
  const pending = usePending();
  const [leaving, startLeave] = useTransition();
  const [out, startOut] = useTransition();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line py-7 lg:flex">
      <Link href="/" className="px-6" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <p className="cap mt-6 flex items-center gap-2 px-6 !text-ink">
        <ShieldCheck size={14} strokeWidth={1.5} /> Administración
      </p>
      <nav className="mt-7 flex flex-col" aria-label="Administración">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <Icon size={17} strokeWidth={1.5} />
              {label}
              {href === "/admin/retiros" && <Count n={pending.retiros} />}
              {href === "/admin/pagos" && <Count n={pending.pagos} />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col border-t border-line pt-4">
        <Link href="/panel" className={itemClass(false)}>
          <ArrowLeftCircle size={17} strokeWidth={1.5} />
          Ver como comercializador
        </Link>
        <button type="button" disabled={leaving} onClick={() => startLeave(() => leaveAdmin())} className={`${itemClass(false)} text-left`}>
          <ShieldCheck size={17} strokeWidth={1.5} />
          {leaving ? "Saliendo…" : "Salir del modo admin"}
        </button>
        <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className={`${itemClass(false)} text-left`}>
          <LogOut size={17} strokeWidth={1.5} />
          {out ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}

export function AdminBottomNav() {
  const path = usePathname();
  const pending = usePending();
  // El menú «Más» queda abierto solo en la página donde se abrió: al navegar se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const more = openAt === path;
  const setMore = (open: boolean | ((v: boolean) => boolean)) => setOpenAt((typeof open === "function" ? open(more) : open) ? path : null);
  const sheet = useRef<HTMLDivElement>(null);
  const [leaving, startLeave] = useTransition();
  const [out, startOut] = useTransition();
  const main = ADMIN_NAV.filter((n) => MOBILE_MAIN.has(n.href));
  const rest = ADMIN_NAV.filter((n) => !MOBILE_MAIN.has(n.href));
  const inRest = rest.some((n) => isActive(path, n.href));

  // Con Escape o tocando fuera, el menú «Más» se cierra.
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    const onDown = (e: PointerEvent) => {
      if (sheet.current && !sheet.current.contains(e.target as Node)) setOpenAt(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [more]);

  const cell = (active: boolean) => `relative flex w-full flex-col items-center gap-1.5 border-t-2 pb-2.5 pt-2.5 text-[0.62rem] ${active ? "border-ink text-ink" : "border-transparent text-mute"}`;
  return (
    <div ref={sheet} className="lg:hidden">
      {more && (
        <div id="admin-more" className="fixed inset-x-0 bottom-[60px] z-40 border-t border-line-strong bg-void/98 pb-2 backdrop-blur-md">
          <ul className="mx-auto max-w-[640px]">
            {rest.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} aria-current={isActive(path, href) ? "page" : undefined} className={itemClass(isActive(path, href))}>
                  <Icon size={17} strokeWidth={1.5} />
                  {label}
                </Link>
              </li>
            ))}
            <li className="border-t border-line">
              <button type="button" disabled={leaving} onClick={() => startLeave(() => leaveAdmin())} className={`${itemClass(false)} w-full text-left`}>
                <ShieldCheck size={17} strokeWidth={1.5} />
                {leaving ? "Saliendo…" : "Salir del modo admin"}
              </button>
            </li>
            <li>
              <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className={`${itemClass(false)} w-full text-left`}>
                <LogOut size={17} strokeWidth={1.5} />
                {out ? "Cerrando sesión…" : "Cerrar sesión"}
              </button>
            </li>
          </ul>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-void/95 backdrop-blur-md" aria-label="Administración">
        <ul className="mx-auto grid max-w-[640px] grid-cols-5">
          {main.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            const dot = (href === "/admin/retiros" && pending.retiros > 0) || (href === "/admin/pagos" && pending.pagos > 0);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cell(active)}>
                  <Icon size={19} strokeWidth={1.5} />
                  {label}
                  {dot && <span className="absolute right-[24%] top-2 h-1.5 w-1.5 bg-ink" aria-label="Hay pendientes" />}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" aria-expanded={more} aria-controls="admin-more" onClick={() => setMore((v) => !v)} className={cell(more || inRest)}>
              <Ellipsis size={19} strokeWidth={1.5} />
              Más
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/** En celular: la marca, el aviso de que es el admin y las salidas. */
export function AdminMobileBar() {
  const [out, startOut] = useTransition();
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-4 lg:hidden">
      <Link href="/" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <div className="flex items-center gap-5 text-sm text-mute">
        <Link href="/panel" className="hover:text-ink">
          Comercializador
        </Link>
        <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className="hover:text-ink">
          {out ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </div>
  );
}

export function AdminTopbar({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const now = usePlantNow(1000);
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-8">
      <div>
        <p className="cap mb-3 flex items-center gap-2 lg:hidden">
          <ShieldCheck size={13} strokeWidth={1.5} /> Administración
        </p>
        <h1 className="display text-[clamp(2.75rem,6vw,4.25rem)]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-[64ch] text-fog">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-5">
        <span className="num hidden text-sm text-mute md:inline">{now ? formatClock(now) : ""}</span>
        {action}
      </div>
    </header>
  );
}

/** Se muestra si alguien con sesión abre /admin sin haber ingresado el PIN. */
export function AdminPinWall({ name, email, allowed }: { name: string; email: string; allowed: boolean }) {
  const [state, action, pending] = useActionState(becomeAdmin, undefined);
  return (
    <div className="mx-auto mt-10 max-w-[460px] sm:mt-20">
      <h1 className="display text-[clamp(2.75rem,8vw,4rem)]">{allowed ? "Entrar como administrador" : "Cuenta no autorizada"}</h1>
      {allowed ? (
        <>
          <p className="mt-5 leading-relaxed text-fog">Hola, {name.split(" ")[0]}. Escribe el PIN de administrador para continuar.</p>
          <form action={action} className="mt-8 space-y-6">
            <div>
              <label htmlFor="pin" className="cap">
                PIN de administrador
              </label>
              <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus placeholder="••••••" className="field num mt-1 tracking-[0.4em]" />
            </div>
            <button type="submit" disabled={pending} className="btn btn-solid w-full">
              {pending ? "Verificando…" : "Entrar a la administración"}
            </button>
            {state?.error && <ErrorNote>{state.error}</ErrorNote>}
          </form>
        </>
      ) : (
        <p className="mt-5 leading-relaxed text-fog">{email} no está en la lista de administradores. Si debes tener acceso, pide que agreguen tu correo a la variable ADMIN_EMAILS.</p>
      )}
      <Link href="/panel" className="link mt-8 inline-block text-sm text-fog">
        Volver a mi panel de comercializador
      </Link>
    </div>
  );
}
