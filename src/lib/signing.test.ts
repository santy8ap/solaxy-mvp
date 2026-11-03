import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildOrderMessage, buildWithdrawalMessage, verifyWalletSignature } from "@/lib/signing";

const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());

const order = {
  code: "SLX-7F3A21",
  kw: 2,
  amountCop: 9_600_000,
  asset: "USDT",
  assetAmount: 2400,
  network: "BNB Smart Chain (BEP-20)",
  walletAddress: account.address,
  createdAt: Date.UTC(2026, 10, 4, 0, 5),
};

describe("mensaje de la orden", () => {
  it("incluye el código, los kW, el total y aclara que no mueve fondos", () => {
    const msg = buildOrderMessage(order);
    expect(msg).toContain("SLX-7F3A21");
    expect(msg).toContain("2,00 kW");
    expect(msg).toContain("9.600.000");
    expect(msg).toContain(account.address);
    expect(msg.toLowerCase()).toContain("no mueve fondos");
  });

  it("el mensaje de retiro incluye el monto y la wallet destino", () => {
    const msg = buildWithdrawalMessage({ code: "RET-1A2B3C", amountCop: 350_000, walletAddress: account.address, createdAt: order.createdAt });
    expect(msg).toContain("RET-1A2B3C");
    expect(msg).toContain("350.000");
    expect(msg).toContain(account.address);
  });
});

describe("verificación de la firma de la wallet", () => {
  it("acepta la firma de la wallet dueña de la dirección", async () => {
    const message = buildOrderMessage(order);
    const signature = await account.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message, signature })).toBe(true);
  });

  it("rechaza la firma de otra wallet", async () => {
    const message = buildOrderMessage(order);
    const signature = await other.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message, signature })).toBe(false);
  });

  it("rechaza un mensaje alterado", async () => {
    const message = buildOrderMessage(order);
    const signature = await account.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message: message.replace("2,00 kW", "20,00 kW"), signature })).toBe(false);
  });

  it("no lanza error con una firma mal formada", async () => {
    expect(await verifyWalletSignature({ address: account.address, message: "x", signature: "0x1234" })).toBe(false);
  });
});
