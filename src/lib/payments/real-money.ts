import "server-only";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { ledgerTx } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { MP_SANDBOX_NETWORK } from "./mercadopago-service";

/** Pagos con dinero real: Mercado Pago (no de pruebas), cripto en la red principal y pagos registrados por el admin. */
export const realPaymentWhere = or(
  and(eq(ledgerTx.method, "mercadopago"), or(isNull(ledgerTx.network), ne(ledgerTx.network, MP_SANDBOX_NETWORK))),
  and(eq(ledgerTx.method, "crypto"), or(isNull(ledgerTx.chainId), ne(ledgerTx.chainId, 97))),
  eq(ledgerTx.method, "manual"),
);

/**
 * Qué pagos cuentan como recaudo en los resúmenes del admin. En modo de pruebas, todos: así los números
 * se mueven con lo que se está probando. Con dinero real, solo los que movieron dinero.
 */
export function collectedWhere() {
  return isDemoMode() ? undefined : realPaymentWhere;
}
