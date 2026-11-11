"use client";
import { createContext, use, type ReactNode } from "react";

export interface PanelUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** Su correo está autorizado como administrador: se le muestra el acceso al admin. */
  canAdmin: boolean;
}

const Ctx = createContext<PanelUser | null>(null);

export function UserProvider({ user, children }: { user: PanelUser; children: ReactNode }) {
  return <Ctx value={user}>{children}</Ctx>;
}

export function useUser() {
  const u = use(Ctx);
  if (!u) throw new Error("useUser debe usarse dentro de UserProvider");
  return u;
}
