import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { getAuthContext } from "@/lib/admin/access";
import { AdminBottomNav, AdminMobileBar, AdminNotAuthorized, AdminSidebar } from "@/components/admin/shell";
import { TestModeBar } from "@/components/panel/shell";
import { UserProvider } from "@/components/panel/user-context";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Administración", template: `%s · Admin ${BRAND.name}` },
  // Las páginas privadas no aparecen en buscadores.
  robots: { index: false, follow: false },
};

// Depende de la sesión y del rol: puede esperar al servidor al navegar.
export const instant = false;

/** El marco del admin: menú lateral (o barra inferior en celular) y el contenido. Solo para administradores. */
function AdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-void">
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh">
        <AdminSidebar />
        <div className="min-w-0 flex-1">
          <TestModeBar />
          <AdminMobileBar />
          <main id="contenido" tabIndex={-1} className="px-4 pb-28 pt-8 outline-none sm:px-10 lg:pb-16 lg:pt-10">
            <div className="mx-auto max-w-[1200px]">{children}</div>
          </main>
        </div>
        <AdminBottomNav />
      </div>
    </>
  );
}

/**
 * Sin sesión va a ingresar; con una cuenta sin acceso, solo ve el aviso (sin el menú del admin, que pediría
 * datos que no puede ver); con una cuenta de propietario o del equipo, el admin completo. Sin PIN.
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/ingresar?rol=admin");
  if (!ctx.isAdmin)
    return (
      <div className="min-h-dvh">
        <TestModeBar />
        <main className="px-4 pb-16 sm:px-10">
          <AdminNotAuthorized email={ctx.user.email} />
        </main>
      </div>
    );
  return (
    <UserProvider user={{ ...ctx.user, canAdmin: true, adminRole: ctx.role }}>
      <AdminFrame>{children}</AdminFrame>
    </UserProvider>
  );
}

function AdminLoading() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Cargando la administración">
      <div className="hidden w-[236px] shrink-0 border-r border-line lg:block" />
      <div className="min-w-0 flex-1 px-4 pt-8 sm:px-10 lg:pt-10">
        <div className="mx-auto max-w-[1200px] space-y-8">
          <div className="skeleton h-16 w-72" />
          <div className="skeleton h-40" />
          <div className="skeleton h-72" />
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<AdminLoading />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
      <Toaster />
    </>
  );
}
