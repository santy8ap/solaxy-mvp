import "server-only";
import { googleEnabled, isDemoMode } from "@/lib/env";
import { cryptoConfig, wompiConfig } from "@/lib/payments/config";

/** Lo que el navegador necesita saber de la configuración del servidor (sin secretos). */
export interface AppConfigDTO {
  demoMode: boolean;
  googleEnabled: boolean;
  wompi: { enabled: boolean; sandbox: boolean };
  crypto: { enabled: boolean; network: "bsc" | "bsc-testnet"; chainId: number; networkName: string; confirmations: number; explorer: string };
}

export function appConfig(): AppConfigDTO {
  const w = wompiConfig();
  const c = cryptoConfig();
  return {
    demoMode: isDemoMode(),
    googleEnabled,
    wompi: { enabled: w.enabled, sandbox: w.sandbox },
    crypto: { enabled: c.enabled, network: c.network, chainId: c.chainId, networkName: c.networkName, confirmations: c.confirmations, explorer: c.explorer },
  };
}
