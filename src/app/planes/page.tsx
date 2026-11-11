import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlanCatalog } from "@/components/plans/plan-catalog";
import { Logo } from "@/components/ui/logo";
import { DataSkeleton } from "@/components/ui/data-state";

export const metadata: Metadata = { title: "Planes de energía" };
async function Catalog({
  searchParams,
}: Pick<PageProps<"/planes">, "searchParams">) {
  const { plan } = await searchParams;
  return (
    <PlanCatalog initialPlanId={typeof plan === "string" ? plan : undefined} />
  );
}
export default function PlansPage({ searchParams }: PageProps<"/planes">) {
  return (
    <>
      <header className="eclipse-header">
        <nav
          className="eclipse-wrap eclipse-navigation"
          aria-label="Planes de energía"
        >
          <Link href="/" aria-label="In World Energy, inicio">
            <Logo />
          </Link>
          <Link href="/ingresar" className="btn btn-ghost">
            Ingresar ↗
          </Link>
        </nav>
      </header>
      <main className="eclipse-wrap public-plans">
        <h1 className="sr-only">Planes de energía para empresas</h1>
        <Link href="/" className="back-link">
          ← Volver al inicio
        </Link>
        <Suspense fallback={<DataSkeleton />}>
          <Catalog searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
