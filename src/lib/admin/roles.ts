/**
 * Los roles de la administración. Isomórfico: lo usan el servidor y la interfaz.
 * - propietario: su correo está en ADMIN_EMAILS (Vercel). Administra todo y elige el equipo.
 * - administrador: un propietario le dio acceso desde Admin › Equipo. Administra todo menos el equipo.
 * Se entra siempre con la cuenta de Google de ese correo.
 */
export type AdminRole = "propietario" | "administrador";

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  propietario: "Propietario",
  administrador: "Administrador",
};
