import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/session";
import { WalletProvider } from "@/lib/wallet/context";
import { CryptoRecovery } from "@/components/panel/crypto-recovery";
import { BottomNav, Sidebar } from "@/components/panel/shell";
import { UserProvider } from "@/components/panel/user-context";
import { ConnectWalletDialog } from "@/components/wallet/connect-dialog";
import { Toaster } from "@/components/ui/toast";

// El panel depende de la sesión: puede esperar al servidor al navegar.
export const instant = false;

async function SessionGate({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/ingresar");
  return (
    <UserProvider user={user}>
      <WalletProvider>
        {children}
        <ConnectWalletDialog />
        <CryptoRecovery />
      </WalletProvider>
    </UserProvider>
  );
}

function PanelLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando tu panel">
      <div className="h-14 w-72 animate-pulse rounded-none bg-silicon-800/70" />
      <div className="h-64 animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/60" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/50" />
        <div className="h-56 animate-pulse rounded-[var(--radius-panel)] bg-silicon-800/50" />
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="panel-layout">
      <a href="#panel-content" className="skip-link">
        Saltar al contenido
      </a>
      <Sidebar />
      <main id="panel-content" className="panel-content">
        <div className="mx-auto max-w-[1180px]">
          <Suspense fallback={<PanelLoading />}>
            <SessionGate>{children}</SessionGate>
          </Suspense>
        </div>
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
