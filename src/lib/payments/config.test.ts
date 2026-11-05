import { afterEach, describe, expect, it, vi } from "vitest";
import { cryptoConfig } from "@/lib/payments/config";

afterEach(() => vi.unstubAllEnvs());

describe("configuración cripto", () => {
  it("necesita una dirección válida de la billetera de la empresa", () => {
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "no-es-una-direccion");
    expect(cryptoConfig().enabled).toBe(false);
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "0x0000000000000000000000000000000000000000");
    expect(cryptoConfig().enabled).toBe(false);
    vi.stubEnv("CRYPTO_TREASURY_ADDRESS", "0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    expect(cryptoConfig().enabled).toBe(true);
  });

  it("usa BNB Chain por defecto y la testnet si se pide", () => {
    vi.stubEnv("CRYPTO_NETWORK", "");
    vi.stubEnv("CRYPTO_CONFIRMATIONS", "");
    vi.stubEnv("USDT_CONTRACT", "");
    expect(cryptoConfig()).toMatchObject({
      network: "bsc",
      chainId: 56,
      confirmations: 5,
      usdtContract: "0x55d398326f99059fF775485246999027B3197955",
    });
    vi.stubEnv("CRYPTO_NETWORK", "bsc-testnet");
    vi.stubEnv("CRYPTO_CONFIRMATIONS", "2");
    expect(cryptoConfig()).toMatchObject({ network: "bsc-testnet", chainId: 97, confirmations: 2 });
  });
});
