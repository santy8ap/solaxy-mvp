import { DataSkeleton } from "@/components/ui/data-state";
export default function PanelLoading() {
  return (
    <div className="account-section">
      <span className="eyebrow">PREPARANDO TU ESPACIO</span>
      <DataSkeleton label="Cargando tu espacio empresarial" />
    </div>
  );
}
