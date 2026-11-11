import type { Metadata } from "next";
import { PlanCatalog } from "@/components/plans/plan-catalog";
import { Topbar } from "@/components/panel/shell";

export const metadata: Metadata = { title: "Planes de energía" };
export default function PlansPage() {
  return (
    <>
      <Topbar
        title="Planes de energía"
        subtitle="Elige el volumen que se ajusta a tu empresa."
      />
      <PlanCatalog />
    </>
  );
}
