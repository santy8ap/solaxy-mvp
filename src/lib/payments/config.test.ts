import { afterEach, describe, expect, it, vi } from "vitest";
import { cryptoConfig, wompiConfig } from "@/lib/payments/config";

afterEach(() => vi.unstubAllEnvs());

describe("configuración de Wompi", () => {
  it("está desactivado sin llaves", () => {
    vi.stubEnv("WOMPI_PUBLIC_KEY", "");
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "");
    expect(wompiConfig().enabled).toBe(false);
  });

  it("la llave pública decide sandbox o producción", () => {
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
    vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_abc");
    expect(wompiConfig()).toMatchObject({ enabled: true, sandbox: true, apiBase: "https://sandbox.wompi.co/v1" });
    vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_prod_abc");
    expect(wompiConfig()).toMatchObject({ enabled: true, sandbox: false, apiBase: "https://production.wompi.co/v1" });
  });

  it("rechaza una llave que no es pública (por ejemplo, la privada)", () => {
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
    vi.stubEnv("WOMPI_PUBLIC_KEY", "prv_test_abc");
    expect(wompiConfig().enabled).toBe(false);
  });
});

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
