import Link from "next/link";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { signInHref } from "@/lib/navigation";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function PublicFrame({
  children,
  active,
  signInDestination,
  authenticated = false,
  accountAction,
  contentClassName = "",
}: {
  children: ReactNode;
  active?: "planes" | "planta" | "ayuda";
  signInDestination?: string;
  authenticated?: boolean;
  accountAction?: ReactNode;
  contentClassName?: string;
}) {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader active={active}>
        {accountAction ?? (
          <Link href={authenticated ? "/panel" : signInHref(signInDestination ?? (active === "planes" ? "/panel/planes" : "/panel"))} prefetch={false} className="btn btn-ghost">
            Mi cuenta ↗
          </Link>
        )}
      </SiteHeader>
      <main id="contenido" className={`eclipse-wrap public-content ${contentClassName}`}>
        {children}
      </main>
      <Toaster />
      <SiteFooter />
    </>
  );
}
