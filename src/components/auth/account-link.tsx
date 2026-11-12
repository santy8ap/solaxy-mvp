"use client";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/avatar";

/**
 * El acceso a la cuenta en las páginas públicas. Esas páginas se generan iguales para todos (son más rápidas),
 * así que la sesión se consulta desde el navegador: con sesión, la foto y «Mi panel»; sin sesión, «Ingresar».
 * Mientras se consulta, el botón ocupa su lugar sin texto para que nada salte.
 */
export function AccountLink({
  variant = "nav",
  guestLabel = "Ingresar",
  guestHref = "/ingresar",
  className = "",
}: {
  /** nav: la cabecera; cta: un botón grande dentro de la página */
  variant?: "nav" | "cta";
  guestLabel?: string;
  guestHref?: string;
  className?: string;
}) {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  const size = variant === "nav" ? "min-h-11 px-2.5 py-2.5 sm:px-4" : "";
  if (isPending)
    return (
      <span aria-hidden="true" className={`btn btn-ghost invisible ${size} ${className}`}>
        {guestLabel}
      </span>
    );
  if (!user)
    return (
      <Link href={guestHref} className={`btn ${variant === "cta" && guestLabel !== "Ingresar" ? "btn-solid" : "btn-ghost"} ${size} ${className}`}>
        {guestLabel}
      </Link>
    );
  return (
    <Link href="/panel" className={`btn btn-ghost inline-flex items-center gap-2.5 ${size} ${className}`} aria-label={`Ir a mi panel, ${user.name}`}>
      <Avatar name={user.name} image={user.image} size={variant === "nav" ? 22 : 24} />
      Mi panel
    </Link>
  );
}
