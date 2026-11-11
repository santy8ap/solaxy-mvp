import type { Metadata } from "next";
import { Suspense } from "react";
import { PlansPage } from "@/components/plans/plans-page";

export const metadata: Metadata = { title: "Planes" };

export default function PlanesPage() {
  return (
    <Suspense fallback={<div className="skeleton h-[420px]" aria-busy="true" />}>
      <PlansPage />
    </Suspense>
  );
}
