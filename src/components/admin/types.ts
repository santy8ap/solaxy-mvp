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

const ACTION_LABEL: Record<string, string> = {
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
  // Acciones del modelo anterior que siguen en la bitácora
  ajuste_kw: "Ajuste (modelo anterior)",
  borrar_datos_demo: "Datos de prueba",
};

export const actionLabel = (action: string) => ACTION_LABEL[action] ?? action;
