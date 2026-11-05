import { describe, expect, it } from "vitest";
import { TRANSFER_TOPIC, quoteBaseUnits, verifyCryptoPayment, type ChainReceipt, type ChainTx, type VerifyInput } from "@/lib/payments/crypto";

const PAYER = "0x1111111111111111111111111111111111111111";
const TREASURY = "0x2222222222222222222222222222222222222222";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const OTHER = "0x3333333333333333333333333333333333333333";
const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}` as `0x${string}`;
const word = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`;

const createdAt = Date.UTC(2026, 10, 5, 15, 0);
const order = { asset: "BNB" as const, payer: PAYER, expectedBaseUnits: 1_714_286_000_000_000_000n, createdAt, expiresAt: createdAt + 20 * 60_000 };
const cfg = { treasury: TREASURY, usdtContract: USDT, confirmations: 5 };
const minedAt = Math.floor((createdAt + 5 * 60_000) / 1000);

function bnbTx(over: Partial<ChainTx> = {}): ChainTx {
  return { hash: "0xaaa", from: PAYER, to: TREASURY, value: order.expectedBaseUnits, ...over };
}
function receipt(over: Partial<ChainReceipt> = {}): ChainReceipt {
  return { status: "success", blockNumber: 100n, logs: [], ...over };
}
function input(over: Partial<VerifyInput> = {}): VerifyInput {
  return { tx: bnbTx(), receipt: receipt(), latestBlock: 104n, blockTimestamp: minedAt, order, cfg, now: createdAt + 6 * 60_000, ...over };
}

describe("cotización exacta", () => {
  it("convierte COP al activo en unidades base, redondeando hacia arriba a 6 decimales", () => {
    // 4.800.000 COP a 2.800.000 COP/BNB = 1,714285714… BNB → 1,714286 BNB
    expect(quoteBaseUnits(4_800_000, 2_800_000, 18)).toBe(1_714_286_000_000_000_000n);
    // 4.800.000 COP a 3.950,5 COP/USDT = 1215,0360713… USDT → 1215,036072 USDT
    expect(quoteBaseUnits(4_800_000, 3950.5, 18)).toBe(1_215_036_072_000_000_000_000n);
  });

  it("nunca cotiza por debajo del valor en COP", () => {
    const units = quoteBaseUnits(1_000_000, 3_333_333.33, 18);
    expect(Number(units) / 1e18 * 3_333_333.33).toBeGreaterThanOrEqual(1_000_000);
  });
});

describe("verificación de un pago en BNB", () => {
  it("con el monto, el destino, el origen y 5 confirmaciones, queda confirmado", () => {
    expect(verifyCryptoPayment(input())).toEqual({ state: "confirmada", confirmations: 5 });
  });

  it("con menos confirmaciones, sigue esperando y dice cuántas lleva", () => {
    expect(verifyCryptoPayment(input({ latestBlock: 102n }))).toEqual({ state: "esperando", confirmations: 3 });
  });

  it("si todavía no hay recibo (está en la red), espera", () => {
    expect(verifyCryptoPayment(input({ receipt: null }))).toMatchObject({ state: "esperando", confirmations: 0 });
  });

  it("un monto incompleto llegó a la billetera: queda por reembolsar", () => {
    const r = verifyCryptoPayment(input({ tx: bnbTx({ value: order.expectedBaseUnits - 1n }) }));
    expect(r).toMatchObject({ state: "por_reembolsar" });
    expect(r.state === "por_reembolsar" && r.reason).toMatch(/incompleto/i);
  });

  it("un monto mayor también sirve", () => {
    expect(verifyCryptoPayment(input({ tx: bnbTx({ value: order.expectedBaseUnits + 10n ** 15n }) })).state).toBe("confirmada");
  });

  it("rechaza si no fue a la billetera de la empresa o no salió de la wallet de la orden", () => {
    expect(verifyCryptoPayment(input({ tx: bnbTx({ to: OTHER }) }))).toMatchObject({ state: "fallida" });
    expect(verifyCryptoPayment(input({ tx: bnbTx({ from: OTHER }) }))).toMatchObject({ state: "fallida" });
  });

  it("rechaza una transacción revertida", () => {
    expect(verifyCryptoPayment(input({ receipt: receipt({ status: "reverted" }) }))).toMatchObject({ state: "fallida" });
  });

  it("rechaza una transacción anterior a la orden", () => {
    const r = verifyCryptoPayment(input({ blockTimestamp: Math.floor((createdAt - 10 * 60_000) / 1000) }));
    expect(r).toMatchObject({ state: "fallida" });
  });

  it("si se pagó mucho después de vencer la cotización, queda por reembolsar", () => {
    const r = verifyCryptoPayment(input({ blockTimestamp: Math.floor((order.expiresAt + 60 * 60_000) / 1000), now: order.expiresAt + 61 * 60_000 }));
    expect(r).toMatchObject({ state: "por_reembolsar" });
  });

  it("si la transacción no aparece: espera, y después de un buen rato falla", () => {
    expect(verifyCryptoPayment(input({ tx: null, receipt: null }))).toMatchObject({ state: "esperando" });
    expect(verifyCryptoPayment(input({ tx: null, receipt: null, now: order.expiresAt + 31 * 60_000 }))).toMatchObject({ state: "fallida" });
  });
});

describe("verificación de un pago en USDT (BEP-20)", () => {
  const usdtOrder = { ...order, asset: "USDT" as const, expectedBaseUnits: 1_215_036_072_000_000_000_000n };
  const transferLog = (over: { address?: string; from?: string; to?: string; amount?: bigint } = {}) => ({
    address: (over.address ?? USDT) as `0x${string}`,
    topics: [TRANSFER_TOPIC, pad(over.from ?? PAYER), pad(over.to ?? TREASURY)] as `0x${string}`[],
    data: word(over.amount ?? usdtOrder.expectedBaseUnits),
  });
  const usdtInput = (logs: ChainReceipt["logs"], tx: Partial<ChainTx> = {}) =>
    input({ order: usdtOrder, tx: { hash: "0xbbb", from: PAYER, to: USDT, value: 0n, ...tx }, receipt: receipt({ logs }) });

  it("valida el evento Transfer del contrato oficial hacia la billetera de la empresa", () => {
    expect(verifyCryptoPayment(usdtInput([transferLog()])).state).toBe("confirmada");
  });

  it("no acepta un token falso que imita a USDT", () => {
    expect(verifyCryptoPayment(usdtInput([transferLog({ address: OTHER })]))).toMatchObject({ state: "fallida" });
  });

  it("no acepta una transferencia a otra dirección", () => {
    expect(verifyCryptoPayment(usdtInput([transferLog({ to: OTHER })]))).toMatchObject({ state: "fallida" });
  });

  it("un monto incompleto queda por reembolsar", () => {
    expect(verifyCryptoPayment(usdtInput([transferLog({ amount: 1000n })]))).toMatchObject({ state: "por_reembolsar" });
  });
});
