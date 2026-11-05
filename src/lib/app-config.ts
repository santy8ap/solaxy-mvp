import "server-only";
import { googleEnabled, isDemoMode } from "@/lib/env";
import { cryptoConfig, mercadoPagoConfig } from "@/lib/payments/config";
import { isMercadoPagoTest } from "@/lib/payments/mercadopago-account";

/** Lo que el navegador necesita saber de la configuración del servidor (sin secretos). */
export interface AppConfigDTO {
  demoMode: boolean;
  googleEnabled: boolean;
  /** Tarjeta, PSE y Nequi con Mercado Pago. `sandbox`: credenciales de prueba, no se cobra dinero real. */
  mercadopago: { enabled: boolean; sandbox: boolean };
  crypto: { enabled: boolean; network: "bsc" | "bsc-testnet"; chainId: number; networkName: string; confirmations: number; explorer: string };
}

export async function appConfig(): Promise<AppConfigDTO> {
  const mp = mercadoPagoConfig();
  const c = cryptoConfig();
  return {
    demoMode: isDemoMode(),
    googleEnabled,
    mercadopago: { enabled: mp.enabled, sandbox: await isMercadoPagoTest() },
    crypto: { enabled: c.enabled, network: c.network, chainId: c.chainId, networkName: c.networkName, confirmations: c.confirmations, explorer: c.explorer },
  };
}
