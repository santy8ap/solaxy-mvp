import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../tests/helpers";
import { historyFilters } from "@/lib/history-filters";
import { bogotaMs } from "@/lib/time";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-history-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");
let history: typeof import("@/lib/transactions");
beforeAll(async () => {
  history = await import("@/lib/transactions");
  const { db } = await import("@/lib/db");
  const { ledgerTx } = await import("@/lib/db/schema");
  await createUser("history-owner", { profile: false });
  await createUser("history-other", { profile: false });
  for (let offset = 0; offset < 502; offset += 100) {
    await db
      .insert(ledgerTx)
      .values(
        Array.from({ length: Math.min(100, 502 - offset) }, (_, index) => ({
          id: `HIST-${String(offset + index).padStart(5, "0")}`,
          userId: "history-owner",
          kind: "plan_mes" as const,
          status: (offset + index === 501 ? "pendiente" : "confirmada") as
            | "pendiente"
            | "confirmada",
          amountCop: 20880000,
          method: "manual" as const,
          createdAt: bogotaMs(2026, 11, 10, 12),
        })),
      );
  }
  await db
    .insert(ledgerTx)
    .values({
      id: "HIST-PRIVATE",
      userId: "history-other",
      kind: "plan_mes",
      status: "confirmada",
      amountCop: 20880000,
      createdAt: bogotaMs(2026, 11, 10, 12),
    });
}, 120000);

describe("historial completo y privado", () => {
  it("pagina más de 60 movimientos y conserva los pagos pendientes", async () => {
    const page = await history.listTransactions(
      "history-owner",
      historyFilters(new URLSearchParams()),
    );
    expect(page.total).toBe(502);
    expect(page.transactions).toHaveLength(20);
    expect(page.transactions[0]).toMatchObject({
      id: "HIST-00501",
      status: "pendiente",
    });
    expect(
      (await history.listTransactions("history-owner", { page: 4 }))
        .transactions,
    ).toHaveLength(20);
  });
  it("la exportación recorre todos los lotes sin duplicar ni incluir otra cuenta", async () => {
    const first = await history.transactionBatch("history-owner", { page: 1 });
    const last = first.at(-1)!;
    const second = await history.transactionBatch(
      "history-owner",
      { page: 1 },
      { createdAt: last.createdAt, id: last.id },
    );
    expect(first).toHaveLength(500);
    expect(second).toHaveLength(2);
    const ids = [...first, ...second].map((row) => row.id);
    expect(new Set(ids).size).toBe(502);
    expect(ids).not.toContain("HIST-PRIVATE");
  });
  it("filtra por fecha de Colombia y por estado", async () => {
    const pending = await history.listTransactions(
      "history-owner",
      historyFilters(
        new URLSearchParams(
          "desde=2026-11-10&hasta=2026-11-10&estado=pendiente",
        ),
      ),
    );
    expect(pending.total).toBe(1);
    expect(
      (
        await history.listTransactions(
          "history-owner",
          historyFilters(new URLSearchParams("desde=2026-11-11")),
        )
      ).total,
    ).toBe(0);
  });
});
