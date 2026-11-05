import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthContext } from "@/lib/admin/access";
import { AdminBottomNav, AdminPinWall, AdminSidebar } from "@/components/admin/shell";
import { UserProvider } from "@/components/panel/user-context";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Admin Solaxy" } };

// Depende de la sesión y del PIN: puede esperar al servidor al navegar.
export const instant = false;

async function AdminGate({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
  if (!ctx.isAdmin) return <AdminPinWall name={ctx.user.name} />;
  return <UserProvider user={ctx.user}>{children}</UserProvider>;
}

function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando administración">
      <div className="h-14 w-72 animate-pulse rounded-2xl bg-silicon-800/70" />
      <div className="h-40 animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/60" />
      <div className="h-72 animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/50" />
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <div className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-[1180px]">
          <Suspense fallback={<AdminLoading />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </div>
      </div>
      <AdminBottomNav />
      <Toaster />
    </div>
  );
}
