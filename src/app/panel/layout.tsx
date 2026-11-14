import { redirect } from "next/navigation";
import { Suspense } from "react";
import { adminRoleOf } from "@/lib/admin/team";
import { getSessionUser } from "@/lib/session";
import { WalletProvider } from "@/lib/wallet/context";
import { CryptoRecovery } from "@/components/panel/crypto-recovery";
import { BottomNav, MobileBar, Sidebar, TestModeBar } from "@/components/panel/shell";
import { UserProvider } from "@/components/panel/user-context";
import { Toaster } from "@/components/ui/toast";
import { ConnectWalletDialog } from "@/components/wallet/connect-dialog";

// El panel depende de la sesión: puede esperar al servidor al navegar.
export const instant = false;

async function SessionGate({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/ingresar");
  return (
    <UserProvider user={{ ...user, canAdmin: (await adminRoleOf(user.email)) !== null }}>
      <WalletProvider>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-void">
          Saltar al contenido
        </a>
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <TestModeBar />
            <MobileBar />
            <main id="contenido" tabIndex={-1} className="px-4 pb-28 pt-8 outline-none sm:px-10 lg:pb-16 lg:pt-10">
              <div className="mx-auto max-w-[1160px]">{children}</div>
            </main>
          </div>
        </div>
        <BottomNav />
        <ConnectWalletDialog />
        <CryptoRecovery />
      </WalletProvider>
    </UserProvider>
  );
}

function PanelLoading() {
  return (
    <div className="mx-auto max-w-[1160px] space-y-8 px-4 pt-10 sm:px-10" aria-busy="true" aria-label="Cargando tu panel">
      <div className="skeleton h-16 w-72" />
      <div className="skeleton h-64" />
      <div className="skeleton h-40" />
    </div>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <>
      <Suspense fallback={<PanelLoading />}>
        <SessionGate>{children}</SessionGate>
      </Suspense>
      <Toaster />
    </>
  );
}
