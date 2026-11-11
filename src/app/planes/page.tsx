import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlanCatalog } from "@/components/plans/plan-catalog";
import { PublicFrame } from "@/components/public/public-frame";
import { DataSkeleton } from "@/components/ui/data-state";

export const metadata: Metadata = { title: "Planes de energía" };
async function Catalog({
  searchParams,
}: Pick<PageProps<"/planes">, "searchParams">) {
  const { plan } = await searchParams;
  return (
    <PlanCatalog
      key={typeof plan === "string" ? plan : "04"}
      initialPlanId={typeof plan === "string" ? plan : undefined}
      headingLevel={1}
    />
  );
}
export default function PlansPage({ searchParams }: PageProps<"/planes">) {
  return (
    <PublicFrame active="planes">
      <Link href="/" className="back-link">
        ← Volver al inicio
      </Link>
      <Suspense fallback={<DataSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </PublicFrame>
  );
}
