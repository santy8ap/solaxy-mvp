/**
 * Los nombres que ve la gente para los estados de los movimientos y los medios de pago. Isomórfico: los usan
 * la interfaz, los comprobantes PDF y las exportaciones CSV, para que todos digan lo mismo.
 */

export const TX_STATUS_LABEL: Record<string, string> = {
  pendiente: "Sin pagar",
  verificando: "Verificando",
  por_aprobar: "En revisión",
  confirmada: "Confirmado",
  rechazada: "Rechazado",
  fallida: "No aprobado",
  cancelada: "Cancelado",
  por_reembolsar: "Por reembolsar",
  reembolsada: "Reembolsado",
};

export const txStatusLabel = (status: string) => TX_STATUS_LABEL[status] ?? status;

/** Para el comercializador, un pago que el admin registró a mano también fue una transferencia bancaria. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  mercadopago: "Mercado Pago",
  crypto: "Cripto",
  transferencia: "Transferencia bancaria",
  manual: "Transferencia bancaria",
  demo: "Pago de prueba",
};

export const paymentMethodLabel = (method: string | null | undefined) => (method ? (PAYMENT_METHOD_LABEL[method] ?? method) : "");

/** En el admin se distingue el pago registrado a mano de la transferencia que reporta el comercializador. */
export const adminMethodLabel = (method: string | null | undefined) => (method === "manual" ? "Registrado a mano" : paymentMethodLabel(method));
