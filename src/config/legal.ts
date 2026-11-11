import { BRAND } from "./brand";

/**
 * Datos legales de los Términos y la Política de Tratamiento de Datos.
 * Los valores entre corchetes los completa la empresa con su abogado.
 * Al cambiar `version`, cada comercializador debe aceptar los textos de nuevo antes de su siguiente compra.
 */
export const LEGAL = {
  version: "2026-11-11",
  /** Pásalo a true cuando el abogado apruebe los textos: desaparece el aviso de borrador. */
  reviewed: false,
  company: BRAND.legalName,
  nit: "[NIT de la empresa]",
  address: "[Dirección de notificaciones]",
  city: "[Ciudad]",
  email: "[correo para datos personales]",
  phone: "[Teléfono de contacto]",
} as const;
