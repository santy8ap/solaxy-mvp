/** Cuentas eliminadas a pedido del titular (Ley 1581). Isomórfico y sin dependencias. */

/** Dominio de los correos de las cuentas eliminadas: «.invalid» está reservado y nunca recibe correo. */
export const DELETED_EMAIL_DOMAIN = "cuentas.invalid";

export const deletedEmail = (userId: string) => `eliminada-${userId}@${DELETED_EMAIL_DOMAIN}`;

export const isDeletedEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${DELETED_EMAIL_DOMAIN}`);
