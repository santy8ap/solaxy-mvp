import { describe, expect, it } from "vitest";
import type { TxDTO } from "@/lib/portfolio";
import { filterTransactions, transactionsCsv } from "./transactions-data";

const base: TxDTO = {
  id: "tx-1",
  kind: "retiro",
  status: "confirmada",
  kw: null,
  amountCop: 20000,
  asset: "COP",
  assetAmount: null,
  network: null,
  walletAddress: null,
  walletName: "Wallet",
  txHash: null,
  note: null,
  createdAt: Date.UTC(2026, 10, 11, 4, 59),
  confirmedAt: null,
  method: null,
  providerStatus: null,
  chainId: null,
};
const empty = { search: "", status: "", from: "", to: "" };
describe("transaction filters and export", () => {
  it("uses Colombia's date boundary and includes both date endpoints", () => {
    const next = {
      ...base,
      id: "tx-2",
      createdAt: Date.UTC(2026, 10, 11, 5, 0),
    };
    expect(
      filterTransactions([next, base], {
        ...empty,
        from: "2026-11-10",
        to: "2026-11-10",
      }).map((tx) => tx.id),
    ).toEqual(["tx-1"]);
    expect(
      filterTransactions([base, next], {
        ...empty,
        from: "2026-11-11",
        to: "2026-11-11",
      }).map((tx) => tx.id),
    ).toEqual(["tx-2"]);
  });
  it("combines status and normalized search without changing the source array", () => {
    const rejected = {
      ...base,
      id: "tx-2",
      status: "rechazada",
      walletName: "Órbita",
    };
    const input = [base, rejected];
    expect(
      filterTransactions(input, {
        ...empty,
        search: "orbita",
        status: "rechazada",
      }),
    ).toEqual([rejected]);
    expect(input).toEqual([base, rejected]);
    expect(
      filterTransactions(input, {
        ...empty,
        from: "2026-11-12",
        to: "2026-11-10",
      }),
    ).toEqual([]);
  });
  it("quotes exported cells and prevents provider text becoming spreadsheet formulas", () => {
    const csv = transactionsCsv([
      { ...base, id: '=HYPERLINK("example")', txHash: "@SUM(1;2)" },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
    expect(csv).toContain('"\'@SUM(1;2)"');
    expect(csv).toContain('"20000"');
    expect(csv).toContain("2026-11-11T04:59:00.000Z");
  });
});
