import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { getAuthContext } from "@/lib/admin/access";
import { adminEmailAllowed } from "@/lib/env";
import { AdminBottomNav, AdminMobileBar, AdminPinWall, AdminSidebar } from "@/components/admin/shell";
import { TestModeBar } from "@/components/panel/shell";
import { UserProvider } from "@/components/panel/user-context";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = { title: { default: "Administración", template: `%s · Admin ${BRAND.name}` } };

// Depende de la sesión y del PIN: puede esperar al servidor al navegar.
export const instant = false;

async function AdminGate({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
  if (!ctx.isAdmin) return <AdminPinWall name={ctx.user.name} email={ctx.user.email} allowed={adminEmailAllowed(ctx.user.email)} />;
  return <UserProvider user={{ ...ctx.user, canAdmin: true }}>{children}</UserProvider>;
}

function AdminLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando la administración">
      <div className="skeleton h-16 w-72" />
      <div className="skeleton h-40" />
      <div className="skeleton h-72" />
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <TestModeBar />
        <AdminMobileBar />
        <div className="px-4 pb-28 pt-8 sm:px-10 lg:pb-16 lg:pt-10">
          <div className="mx-auto max-w-[1200px]">
            <Suspense fallback={<AdminLoading />}>
              <AdminGate>{children}</AdminGate>
            </Suspense>
          </div>
        </div>
      </div>
      <AdminBottomNav />
      <Toaster />
    </div>
  );
}
