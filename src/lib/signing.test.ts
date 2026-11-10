import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildPayerProofMessage, buildWithdrawalMessage, verifyWalletSignature } from "@/lib/signing";

const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const withdrawal = { code: "RET-1A2B3C", amountCop: 350_000, walletAddress: account.address, createdAt: Date.UTC(2026, 10, 4, 0, 5) };

describe("mensajes que firma la wallet", () => {
  it("el mensaje de retiro incluye el código, el monto y la wallet destino, y aclara que no mueve fondos", () => {
    const msg = buildWithdrawalMessage(withdrawal);
    expect(msg).toContain("RET-1A2B3C");
    expect(msg).toContain("350.000");
    expect(msg).toContain(account.address);
    expect(msg.toLowerCase()).toContain("no mueve fondos");
  });

  it("la prueba de propiedad nombra la wallet y la cuenta, así no sirve para otro usuario", () => {
    const msg = buildPayerProofMessage({ userId: "usuario-1", payer: account.address.toLowerCase(), issuedAt: withdrawal.createdAt });
    expect(msg).toContain(account.address);
    expect(msg).toContain("usuario-1");
    expect(msg).not.toBe(buildPayerProofMessage({ userId: "usuario-2", payer: account.address, issuedAt: withdrawal.createdAt }));
  });
});

describe("verificación de la firma de la wallet", () => {
  const message = buildWithdrawalMessage(withdrawal);

  it("acepta la firma de la wallet dueña de la dirección", async () => {
    const signature = await account.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message, signature })).toBe(true);
  });

  it("rechaza la firma de otra wallet", async () => {
    const signature = await other.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message, signature })).toBe(false);
  });

  it("rechaza un mensaje alterado", async () => {
    const signature = await account.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message: message.replace("350.000", "3.500.000"), signature })).toBe(false);
  });

  it("no lanza error con una firma mal formada", async () => {
    expect(await verifyWalletSignature({ address: account.address, message: "x", signature: "0x1234" })).toBe(false);
  });
});
