import { expect, it } from "vitest";
import type { TxDTO } from "@/lib/portfolio";
import { transactionPrintHtml } from "./transaction-print";
it("escapes external text and preserves the actual status, amount and confirmation state", () => {
  const tx: TxDTO = {
    id: '<script>alert("x")</script>',
    kind: "retiro",
    status: "pendiente",
    kw: null,
    amountCop: 25000,
    asset: "COP",
    assetAmount: null,
    network: null,
    walletAddress: null,
    walletName: '<img src=x onerror="alert(1)">',
    txHash: '<svg onload="alert(1)">',
    note: null,
    createdAt: Date.UTC(2026, 10, 11, 12),
    confirmedAt: null,
    method: "crypto",
    providerStatus: null,
    chainId: 56,
  };
  const html = transactionPrintHtml(tx);
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<svg onload=");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Pendiente");
  expect(html).toContain("25.000,00");
  expect(html).toContain("Sin confirmar");
  expect(html).toContain("No sustituye una factura");
});
