import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanCatalog } from "@/components/plans/plan-catalog";
import { Topbar } from "@/components/panel/shell";
import { DataSkeleton } from "@/components/ui/data-state";
export const metadata: Metadata = { title: "Planes de energía" };
async function Catalog({
  searchParams,
}: Pick<PageProps<"/panel/planes">, "searchParams">) {
  const { plan } = await searchParams;
  return (
    <PlanCatalog
      key={typeof plan === "string" ? plan : "04"}
      initialPlanId={typeof plan === "string" ? plan : undefined}
    />
  );
}
export default function PlansPage({
  searchParams,
}: PageProps<"/panel/planes">) {
  return (
    <>
      <Topbar
        title="Planes de energía"
        subtitle="Elige el volumen que se ajusta a tu empresa."
      />
      <Suspense fallback={<DataSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </>
  );
}
