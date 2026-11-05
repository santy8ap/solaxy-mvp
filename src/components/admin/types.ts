import type { PlantSettings } from "@/lib/plant-settings";
import type { TxDTO } from "@/lib/portfolio";

export interface AuditEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  action: "ajuste_kw" | "config_planta" | "aprobar_retiro" | "rechazar_retiro";
  targetUserId: string | null;
  summary: string;
  detail: string | null;
  createdAt: number;
}

export interface OverviewDTO {
  settings: PlantSettings;
  capacityKwp: number;
  soldKw: number;
  availableKw: number;
  investors: number;
  capitalCop: number;
  pendingWithdrawals: number;
  pendingWithdrawalsCop: number;
  activeOffers: number;
  recent: AuditEntry[];
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  real: boolean;
  kw: number;
  investedCop: number;
  earnedCop: number;
  lastActivity: number | null;
}

export interface AdminWithdrawal extends TxDTO {
  userId: string;
  userName: string;
  signed: boolean;
}

export const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  ajuste_kw: "Ajuste de kW",
  config_planta: "Configuración",
  aprobar_retiro: "Retiro aprobado",
  rechazar_retiro: "Retiro rechazado",
};
