import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { formatUnits, getAddress, isAddress } from "viem";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { orderCode } from "@/lib/ids";
import { isDemoMode } from "@/lib/env";
import {
  closeOrder,
  fulfillOrder,
  getOrder,
  markProviderStatus,
  type OrderRow,
} from "@/lib/orders";
import { resolvePlanPayment } from "@/lib/plans/service";
import { requireCompleteProfile } from "@/lib/profile";
import { buildPayerProofMessage, verifyWalletSignature } from "@/lib/signing";
import { rpcChainReader, type ChainReader } from "./chain";
import { cryptoConfig } from "./config";
import {
  quoteBaseUnits,
  verifyCryptoPayment,
  type CryptoAsset,
  type VerifyResult,
} from "./crypto";
import { payLog } from "./log";
import { liveCopPrices } from "./prices";
import { assertExpectedPayment } from "./plan-target";

/** Vigencia de una cotización cripto. */
export const QUOTE_TTL_MS = 20 * 60_000;

export interface CryptoDeps {
  fetch?: typeof fetch;
  reader?: ChainReader;
}

function enabledConfig() {
  const cfg = cryptoConfig();
  if (!cfg.enabled || !cfg.treasury)
    throw new MarketError(
      "El pago con cripto todavía no está configurado.",
      503,
    );
  // Con cobros reales, las monedas de la red de pruebas no son dinero: no se aceptan.
  if (cfg.network === "bsc-testnet" && !isDemoMode())
    throw new MarketError(
      "El pago con cripto está en la red de pruebas: todavía no se puede usar para cobros reales.",
      503,
    );
  return { ...cfg, treasury: cfg.treasury };
}

/** Una firma de propiedad vale 10 minutos (y se tolera un reloj adelantado hasta 2 minutos). */
const PROOF_TTL_MS = 10 * 60_000;

/** Cotiza con el precio en vivo y crea la orden con el monto exacto y 20 minutos de vigencia. */
export async function createCryptoQuote(
  input: {
    userId: string;
    /** Primer mes de un plan nuevo… */
    planId?: string;
    /** …o el mes siguiente de un plan del usuario */
    subscriptionId?: string;
    expectedAmountCop?: number;
    expectedSaleCopPerKwh?: number;
    asset: CryptoAsset;
    payer: string;
    walletName: string;
    /** Firma de la wallet que paga (buildPayerProofMessage): prueba que es del usuario */
    proof: { signature: string; issuedAt: number };
  },
  deps: CryptoDeps = {},
) {
  const cfg = enabledConfig();
  if (!isAddress(input.payer))
    throw new MarketError("Conecta una wallet válida para pagar");
  const now = Date.now();
  const age = now - input.proof.issuedAt;
  const owns =
    age <= PROOF_TTL_MS &&
    age >= -2 * 60_000 &&
    (await verifyWalletSignature({
      address: input.payer,
      message: buildPayerProofMessage({
        userId: input.userId,
        payer: input.payer,
        issuedAt: input.proof.issuedAt,
      }),
      signature: input.proof.signature,
    }));
  if (!owns)
    throw new MarketError(
      "No pudimos comprobar que la wallet es tuya. Firma de nuevo desde la wallet con la que vas a pagar.",
      403,
    );
  await requireCompleteProfile(input.userId);
  const p = await resolvePlanPayment(
    input.userId,
    { planId: input.planId, subscriptionId: input.subscriptionId },
    now,
  );
  assertExpectedPayment(p, input);
  const prices = await liveCopPrices(deps);
  const priceCop = prices[input.asset];
  const baseUnits = quoteBaseUnits(p.amountCop, priceCop, 18);
  const orderId = orderCode();
  const expiresAt = now + QUOTE_TTL_MS;
  await db.insert(ledgerTx).values({
    id: orderId,
    userId: input.userId,
    kind: "plan_mes",
    status: "pendiente",
    amountCop: p.amountCop,
    asset: input.asset,
    assetAmount: Number(formatUnits(baseUnits, 18)),
    network: cfg.networkName,
    chainId: cfg.chainId,
    walletAddress: getAddress(input.payer),
    walletName: input.walletName.slice(0, 40),
    createdAt: now,
    method: "crypto",
    expectedAmount: baseUnits.toString(),
    expiresAt,
    subscriptionId: p.subscriptionId,
    periodIndex: p.periodIndex,
    kwh: p.kwh,
  });
  payLog("orden_creada", {
    proveedor: "crypto",
    orderId,
    userId: input.userId,
    plan: p.subscriptionId,
    mes: p.periodIndex,
    kwh: p.kwh,
    amountCop: p.amountCop,
    asset: input.asset,
    monto: formatUnits(baseUnits, 18),
    precioCop: priceCop,
    red: cfg.network,
  });
  return {
    orderId,
    planName: p.planName,
    periodIndex: p.periodIndex,
    amountCop: p.amountCop,
    asset: input.asset,
    amount: formatUnits(baseUnits, 18),
    amountBaseUnits: baseUnits.toString(),
    priceCop,
    to: cfg.treasury,
    tokenContract: input.asset === "USDT" ? cfg.usdtContract : null,
    chainId: cfg.chainId,
    networkName: cfg.networkName,
    explorer: cfg.explorer,
    confirmations: cfg.confirmations,
    expiresAt,
  };
}

export interface CryptoStatus {
  order: OrderRow;
  state: VerifyResult["state"] | "pendiente" | "cerrada";
  confirmations: number;
  needed: number;
}

const checkedChains = new WeakSet<ChainReader>();

async function ensureChain(reader: ChainReader, chainId: number) {
  if (checkedChains.has(reader)) return;
  let actual: number;
  try {
    actual = await reader.getChainId();
  } catch {
    throw new MarketError(
      "No pudimos conectarnos a BNB Chain. Intenta de nuevo en un momento.",
      503,
    );
  }
  if (actual !== chainId) {
    payLog("red_equivocada", { esperada: chainId, nodo: actual });
    throw new MarketError(
      "El nodo de BNB Chain configurado está en otra red. Revisa BSC_RPC_URL y CRYPTO_NETWORK.",
      503,
    );
  }
  checkedChains.add(reader);
}

function statusOf(
  order: OrderRow,
  needed: number,
  confirmations = 0,
): CryptoStatus {
  const state =
    order.status === "confirmada"
      ? "confirmada"
      : order.status === "pendiente"
        ? "pendiente"
        : order.status === "verificando"
          ? "esperando"
          : order.status === "por_reembolsar"
            ? "por_reembolsar"
            : order.status === "fallida"
              ? "fallida"
              : "cerrada";
  return { order, state, confirmations, needed };
}

/** Verifica en la cadena una orden que ya tiene hash. Idempotente: se puede llamar cuantas veces se quiera. */
export async function verifyCryptoOrder(
  orderId: string,
  deps: CryptoDeps = {},
): Promise<CryptoStatus> {
  const cfg = enabledConfig();
  const order = await getOrder(orderId);
  if (!order || order.method !== "crypto")
    throw new MarketError("Orden no encontrada", 404);
  if (order.status !== "verificando" || !order.providerId)
    return statusOf(order, cfg.confirmations);

  const reader = deps.reader ?? rpcChainReader(cfg.rpcUrl);
  await ensureChain(reader, cfg.chainId);
  const hash = order.providerId as `0x${string}`;
  let result: VerifyResult;
  try {
    const [tx, receipt, latestBlock] = await Promise.all([
      reader.getTransaction(hash),
      reader.getReceipt(hash),
      reader.getBlockNumber(),
    ]);
    const blockTimestamp = receipt
      ? await reader.getBlockTimestamp(receipt.blockNumber)
      : null;
    result = verifyCryptoPayment({
      tx,
      receipt,
      latestBlock,
      blockTimestamp,
      order: {
        asset: order.asset as CryptoAsset,
        payer: order.walletAddress ?? "",
        expectedBaseUnits: BigInt(order.expectedAmount ?? "0"),
        createdAt: order.createdAt,
        expiresAt: order.expiresAt ?? order.createdAt + QUOTE_TTL_MS,
      },
      cfg: {
        treasury: cfg.treasury,
        usdtContract: cfg.usdtContract,
        confirmations: cfg.confirmations,
      },
      now: Date.now(),
    });
  } catch (err) {
    payLog("verificacion_fallida", {
      proveedor: "crypto",
      orderId,
      hash,
      error: String(err).slice(0, 300),
    });
    throw new MarketError(
      "No pudimos consultar BNB Chain. Volveremos a intentarlo.",
      503,
    );
  }

  switch (result.state) {
    case "esperando":
      await markProviderStatus(orderId, {
        providerStatus: `${result.confirmations}/${cfg.confirmations} confirmaciones`,
      });
      break;
    case "confirmada":
      await fulfillOrder(orderId, {
        providerStatus: `${result.confirmations} confirmaciones`,
      });
      break;
    case "por_reembolsar":
      await closeOrder(
        orderId,
        "por_reembolsar",
        { note: result.reason, providerStatus: "recibida" },
        ["verificando"],
      );
      break;
    case "fallida":
      // El hash se libera: si era de otra persona, su dueño todavía puede usarlo.
      await closeOrder(
        orderId,
        "fallida",
        {
          note: result.reason,
          providerId: null,
          providerStatus: "rechazada",
          txHash: hash,
        },
        ["verificando"],
      );
      break;
  }
  const current = (await getOrder(orderId)) ?? order;
  return {
    ...statusOf(
      current,
      cfg.confirmations,
      "confirmations" in result ? result.confirmations : 0,
    ),
  };
}

function isUniqueViolation(err: unknown) {
  return (
    /UNIQUE/i.test(String((err as { message?: string })?.message ?? err)) ||
    /UNIQUE/i.test(String((err as { cause?: unknown })?.cause ?? ""))
  );
}

/** Registra el hash que devolvió la wallet y verifica de una vez. */
export async function submitCryptoPayment(
  input: { userId: string; orderId: string; txHash: string },
  deps: CryptoDeps = {},
): Promise<CryptoStatus> {
  enabledConfig();
  const hash = input.txHash.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash))
    throw new MarketError("El hash de la transacción no es válido");
  const order = await getOrder(input.orderId);
  if (!order || order.userId !== input.userId || order.method !== "crypto")
    throw new MarketError("Orden no encontrada", 404);
  if (order.providerId === hash) return verifyCryptoOrder(order.id, deps);
  // Una cotización que se canceló por vencida todavía admite su hash: si el pago salió a tiempo se activa el
  // mes, y si salió tarde queda por reembolsar. En ambos casos el dinero que llegó no se pierde de vista.
  const expired = order.status === "cancelada" && !order.providerId;
  if (!expired && order.status !== "pendiente" && order.status !== "verificando")
    throw new MarketError("Esta orden ya está cerrada", 409);
  if (order.providerId)
    throw new MarketError(
      "Esta orden ya tiene una transacción registrada",
      409,
    );

  const claim = () =>
    markProviderStatus(
      order.id,
      {
        providerId: hash,
        txHash: hash,
        status: "verificando",
        providerStatus: "enviada",
        ...(expired && { note: null }),
      },
      expired ? ["cancelada"] : undefined,
    );
  try {
    await claim();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Otra orden tiene este hash: si todavía está verificando, se verifica (y se libera si no era suya).
    const [holder] = await db
      .select()
      .from(ledgerTx)
      .where(and(eq(ledgerTx.method, "crypto"), eq(ledgerTx.providerId, hash)));
    if (holder?.status === "verificando")
      await verifyCryptoOrder(holder.id, deps).catch(() => undefined);
    try {
      await claim();
    } catch (again) {
      if (isUniqueViolation(again))
        throw new MarketError(
          "Esa transacción ya se registró para otro pago",
          409,
        );
      throw again;
    }
  }
  payLog("hash_registrado", { proveedor: "crypto", orderId: order.id, hash });
  return verifyCryptoOrder(order.id, deps);
}

/** Reintenta los pagos cripto del usuario que quedaron verificando (por ejemplo, si cerró la pestaña). */
export async function retryUserCryptoOrders(
  userId: string,
  deps: CryptoDeps = {},
) {
  if (!cryptoConfig().enabled) return;
  const pending = await db
    .select({ id: ledgerTx.id })
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.userId, userId),
        eq(ledgerTx.method, "crypto"),
        inArray(ledgerTx.status, ["verificando"]),
      ),
    )
    .limit(5);
  for (const o of pending) {
    try {
      await verifyCryptoOrder(o.id, deps);
    } catch {
      /* se reintentará la próxima vez */
    }
  }
}
