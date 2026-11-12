import type { AdminAction } from "@/lib/db/schema";
import type { PlantSettings } from "@/lib/plant-settings";
import type { SubscriptionDTO, TxDTO } from "@/lib/portfolio";

export interface AuditEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  action: AdminAction | string;
  targetUserId: string | null;
  summary: string;
  detail: string | null;
  createdAt: number;
}

export interface OverviewDTO {
  settings: PlantSettings;
  plantDailyKwh: number;
  contractedDailyKwh: number;
  availableDailyKwh: number;
  activePlans: number;
  pausedPlans: number;
  clients: number;
  collectedCop: number;
  generatedKwh: number;
  soldCop: number;
  owedCop: number;
  paidOutCop: number;
  pendingWithdrawals: number;
  pendingWithdrawalsCop: number;
  paymentsToRefund: number;
  /** Transferencias reportadas por las empresas que esperan confirmación */
  transfersToConfirm: number;
  /** Devoluciones que requieren conciliación */
  reviewsPending: number;
  /** Mensualidades que vencen en los próximos 7 días */
  dueSoon: number;
  monthCollectedCop: number;
  previousMonthCollectedCop: number;
  registeredClients: number;
  /** Solicitudes de eliminación de datos personales sin responder */
  dataRequests: number;
  recent: AuditEntry[];
}

export interface AdminClient {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  profile: {
    companyName: string;
    nit: string;
    fullName: string;
    docType: string;
    docNumber: string;
    phone: string;
    city: string;
    termsAcceptedAt: number | null;
    /** Datos completos y versión vigente de los términos aceptada */
    termsCurrent: boolean;
  } | null;
  plans: SubscriptionDTO[];
  generatedKwh: number;
  soldCop: number;
  profitCop: number;
  withdrawnCop: number;
  reservedCop: number;
  balanceCop: number;
  /** Transferencias reportadas que esperan confirmación */
  openTransfers: number;
  /** Último pago confirmado (ms) */
  lastPaymentAt: number | null;
  /** Pidió eliminar su cuenta y espera respuesta (Ley 1581) */
  deletionRequest: { id: string; createdAt: number; dueAt: number; reason: string | null; blockers: string[] } | null;
}

export interface AdminWithdrawal extends TxDTO {
  userId: string;
  userName: string;
  userEmail: string;
  fullName: string | null;
  companyName: string | null;
  nit: string | null;
  bankAccountNumber: string | null;
  signed: boolean;
}

/** Cada acción de la bitácora con su nombre legible. El tipo obliga a nombrar las acciones nuevas. */
const ACTION_LABEL: Record<AdminAction, string> = {
  config_planta: "Configuración",
  pago_manual: "Pago manual",
  config_transferencia: "Cuenta para transferencias",
  confirmar_transferencia: "Transferencia confirmada",
  rechazar_transferencia: "Transferencia rechazada",
  cerrar_plan: "Plan cerrado",
  aprobar_retiro: "Retiro aprobado",
  rechazar_retiro: "Retiro rechazado",
  reverificar_pago: "Pago re-verificado",
  registrar_hash: "Hash registrado",
  marcar_reembolso: "Reembolso",
  borrar_datos_prueba: "Datos de prueba",
  conciliar_devolucion: "Conciliación",
  devolucion_proveedor: "Devolución de Mercado Pago",
  eliminar_cuenta: "Cuenta eliminada",
  responder_solicitud_datos: "Solicitud de datos respondida",
};

/** Acciones del modelo anterior que siguen en la bitácora. */
const LEGACY_LABEL: Record<string, string> = {
  ajuste_kw: "Ajuste (modelo anterior)",
  borrar_datos_demo: "Datos de prueba",
};

/** Para el filtro de la bitácora: cada acción con su nombre, en orden alfabético. */
export const ACTION_OPTIONS = Object.entries(ACTION_LABEL)
  .map(([id, label]) => ({ id, label }))
  .sort((a, b) => a.label.localeCompare(b.label, "es"));

export const actionLabel = (action: string) =>
  (ACTION_LABEL as Record<string, string>)[action] ?? LEGACY_LABEL[action] ?? action.replaceAll("_", " ");
