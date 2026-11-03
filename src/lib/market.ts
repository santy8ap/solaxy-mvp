import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { PLANT } from "@/config/plant";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { ledgerTx, listing, positionEntry, user, walletLink } from "@/lib/db/schema";
import { newId, orderCode, simulatedTxHash } from "@/lib/ids";
import { getBalances, getKwPosition, round1, toTxDTO } from "@/lib/portfolio";
import { getRates, type Asset } from "@/lib/rates";
import { buildOrderMessage, buildWithdrawalMessage, verifyWalletSignature } from "@/lib/signing";

export class MarketError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const ORDER_TTL_MS = 15 * 60_000;
export const QR_WALLET_NAME = "Pago QR (demo)";

export const NETWORKS: Record<Asset, { network: string; chainId: number | null }[]> = {
  USDT: [
    { network: "BNB Smart Chain (BEP-20)", chainId: 56 },
    { network: "Ethereum (ERC-20)", chainId: 1 },
  ],
  BNB: [{ network: "BNB Smart Chain", chainId: 56 }],
  ETH: [{ network: "Ethereum", chainId: 1 }],
  BTC: [{ network: "Bitcoin", chainId: null }],
};

/** kW vendidos por la plataforma (suma de todas las posiciones). */
export async function soldKw() {
  const [r] = await db
    .select({ kw: sql<number>`coalesce(sum(${positionEntry.kwDelta}), 0)` })
    .from(positionEntry)
    .where(eq(positionEntry.plantId, PLANT.id));
  return round1(r.kw);
}

export async function platformStats() {
  const { spec, econ, settings } = await ensureReady();
  const sold = await soldKw();
  const [inv] = await db.select({ n: sql<number>`count(*)` }).from(
    db
      .select({ u: positionEntry.userId })
      .from(positionEntry)
      .groupBy(positionEntry.userId)
      .having(gt(sql`sum(${positionEntry.kwDelta})`, 0))
      .as("holders"),
  );
  const [cap] = await db
    .select({ cop: sql<number>`coalesce(sum(${ledgerTx.amountCop}), 0)` })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.status, "confirmada"), sql`${ledgerTx.kind} in ('compra','asignacion_demo')`));
  const recent = await db
    .select({ name: user.name, kw: ledgerTx.kw, asset: ledgerTx.asset, walletName: ledgerTx.walletName, at: ledgerTx.createdAt })
    .from(ledgerTx)
    .innerJoin(user, eq(user.id, ledgerTx.userId))
    .where(and(eq(ledgerTx.status, "confirmada"), sql`${ledgerTx.kind} in ('compra','compra_p2p')`))
    .orderBy(desc(ledgerTx.createdAt))
    .limit(8);
  return {
    capacityKwp: spec.capacityKwp,
    soldKw: sold,
    availableKw: round1(spec.capacityKwp - sold),
    investors: inv.n,
    capitalCop: cap.cop,
    pricePerKwCop: econ.pricePerKwCop,
    commissionPct: settings.commissionPct,
    tariffDayCop: settings.tariffDayCop,
    tariffPeakCop: settings.tariffPeakCop,
    plantName: settings.name,
    recent: recent.map((r) => ({ ...r, name: anonymize(r.name) })),
  };
}

function anonymize(name: string) {
  const [first, last] = name.split(" ");
  return last ? `${first} ${last[0]}.` : first;
}

export async function marketSnapshot(userId: string) {
  const { spec, econ } = await ensureReady();
  const sold = await soldKw();
  const rows = await db
    .select({
      id: listing.id,
      sellerId: listing.sellerId,
      sellerName: user.name,
      kw: listing.kw,
      pricePerKwCop: listing.pricePerKwCop,
      createdAt: listing.createdAt,
    })
    .from(listing)
    .innerJoin(user, eq(user.id, listing.sellerId))
    .where(eq(listing.status, "activa"))
    .orderBy(listing.pricePerKwCop);
  const pos = await getKwPosition(userId);
  return {
    plant: {
      id: spec.id,
      name: spec.name,
      location: spec.location,
      capacityKwp: spec.capacityKwp,
      soldKw: sold,
      availableKw: round1(spec.capacityKwp - sold),
      pricePerKwCop: econ.pricePerKwCop,
      minKw: econ.minPurchaseKw,
      maxKw: econ.maxPurchaseKw,
      instantSellFactor: econ.instantSellFactor,
    },
    listings: rows
      .filter((r) => r.sellerId !== userId)
      .map((r) => ({ ...r, sellerName: anonymize(r.sellerName), sellerId: undefined })),
    myListings: rows.filter((r) => r.sellerId === userId).map((r) => ({ ...r, sellerName: "Tú", sellerId: undefined })),
    position: { kw: pos.kw, listedKw: pos.listedKw, availableKw: pos.availableKw, investedCop: Math.round(pos.investedCop) },
    rates: await getRates(),
  };
}

/* ───────────── Compras ───────────── */

export interface BuyInput {
  userId: string;
  kw?: number;
  listingId?: string;
  asset: Asset;
  network: string;
  chainId: number | null;
  /** null cuando se paga por QR (cualquier wallet) */
  walletAddress: string | null;
  walletName: string;
}

export async function createBuyOrder(input: BuyInput) {
  const { spec, econ } = await ensureReady();
  const now = Date.now();
  let kw: number;
  let pricePerKw: number = econ.pricePerKwCop;

  if (input.listingId) {
    const [l] = await db.select().from(listing).where(eq(listing.id, input.listingId));
    if (!l || l.status !== "activa") throw new MarketError("Esa oferta ya no está disponible", 409);
    if (l.sellerId === input.userId) throw new MarketError("No puedes comprar tu propia oferta");
    kw = l.kw;
    pricePerKw = l.pricePerKwCop;
  } else {
    kw = round1(input.kw ?? 0);
    if (kw < econ.minPurchaseKw || kw > econ.maxPurchaseKw) {
      throw new MarketError(`Puedes comprar entre ${econ.minPurchaseKw} y ${econ.maxPurchaseKw} kW`);
    }
    const available = spec.capacityKwp - (await soldKw());
    if (kw > available) throw new MarketError("La planta no tiene tantos kW disponibles", 409);
  }

  const rates = await getRates();
  const amountCop = Math.round(kw * pricePerKw);
  const assetAmount = amountCop / rates.prices[input.asset].cop;
  const code = orderCode();
  const message = buildOrderMessage({
    code,
    kw,
    amountCop,
    asset: input.asset,
    assetAmount,
    network: input.network,
    walletAddress: input.walletAddress ?? QR_WALLET_NAME,
    createdAt: now,
  });
  await db.insert(ledgerTx).values({
    id: code,
    userId: input.userId,
    kind: input.listingId ? "compra_p2p" : "compra",
    status: "pendiente",
    kw,
    amountCop,
    asset: input.asset,
    assetAmount,
    network: input.network,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    walletName: input.walletName,
    message,
    listingId: input.listingId ?? null,
    createdAt: now,
  });
  return { orderId: code, message, kw, amountCop, assetAmount, asset: input.asset, network: input.network, expiresAt: now + ORDER_TTL_MS, rateSource: rates.source };
}

export async function confirmBuyOrder(userId: string, orderId: string, proof: { signature?: string; simulated?: boolean }) {
  const { spec } = await ensureReady();
  const now = Date.now();
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.id, orderId), eq(ledgerTx.userId, userId)));
  if (!tx || (tx.kind !== "compra" && tx.kind !== "compra_p2p")) throw new MarketError("Orden no encontrada", 404);
  if (tx.status === "confirmada") return { ...toTxDTO(tx), alreadyConfirmed: true };
  if (tx.status !== "pendiente") throw new MarketError("Esta orden ya no se puede confirmar", 409);
  if (now - tx.createdAt > ORDER_TTL_MS) {
    await db.update(ledgerTx).set({ status: "fallida" }).where(eq(ledgerTx.id, orderId));
    throw new MarketError("La orden expiró. Crea una nueva.", 410);
  }
  const isQr = tx.walletName === QR_WALLET_NAME;
  if (isQr ? !proof.simulated : !proof.signature) throw new MarketError("Falta la firma de la wallet");
  if (!isQr) {
    const valid = await verifyWalletSignature({ address: tx.walletAddress ?? "", message: tx.message ?? "", signature: proof.signature ?? "" });
    if (!valid) throw new MarketError("La firma no corresponde a la wallet de la orden", 400);
  }
  const signature = isQr ? null : (proof.signature ?? null);

  const kw = tx.kw ?? 0;
  const txHash = simulatedTxHash();

  if (!tx.listingId) {
    const available = spec.capacityKwp - (await soldKw());
    if (kw > available) throw new MarketError("La planta se quedó sin kW disponibles", 409);
  }

  // Reclamar la orden de forma atómica: si llegan dos confirmaciones a la vez
  // (doble clic, reintento de red), solo una asigna los kW.
  const claimed = await db
    .update(ledgerTx)
    .set({ status: "confirmada", signature, txHash, confirmedAt: now })
    .where(and(eq(ledgerTx.id, orderId), eq(ledgerTx.status, "pendiente")))
    .returning({ id: ledgerTx.id });
  if (!claimed.length) {
    const [current] = await db.select().from(ledgerTx).where(eq(ledgerTx.id, orderId));
    if (current?.status === "confirmada") return { ...toTxDTO(current), alreadyConfirmed: true };
    throw new MarketError("Esta orden ya no se puede confirmar", 409);
  }

  const ops = [];
  if (tx.listingId) {
    // La oferta también se reclama de forma atómica.
    const [l] = await db
      .update(listing)
      .set({ status: "vendida", closedAt: now, buyerId: userId })
      .where(and(eq(listing.id, tx.listingId), eq(listing.status, "activa")))
      .returning();
    if (!l) {
      await db.update(ledgerTx).set({ status: "fallida" }).where(eq(ledgerTx.id, orderId));
      throw new MarketError("Esa oferta se vendió mientras firmabas", 409);
    }
    const seller = await getKwPosition(l.sellerId, now);
    const avgCost = seller.kw > 0 ? Math.round(seller.investedCop / seller.kw) : l.pricePerKwCop;
    ops.push(
      db.insert(positionEntry).values({ id: newId("pe-"), userId: l.sellerId, plantId: PLANT.id, kwDelta: -kw, pricePerKwCop: avgCost, ts: now, txId: tx.id }),
      db.insert(ledgerTx).values({
        id: newId("tx-"),
        userId: l.sellerId,
        kind: "venta_p2p",
        status: "confirmada",
        kw,
        amountCop: tx.amountCop,
        asset: "COP",
        listingId: l.id,
        txHash,
        createdAt: now,
        confirmedAt: now,
      }),
    );
  }
  ops.push(
    db.insert(positionEntry).values({
      id: newId("pe-"),
      userId,
      plantId: PLANT.id,
      kwDelta: kw,
      pricePerKwCop: Math.round(tx.amountCop / kw),
      ts: now,
      txId: tx.id,
    }),
  );
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);
  return { ...toTxDTO({ ...tx, status: "confirmada", signature, txHash, confirmedAt: now }), alreadyConfirmed: false };
}

/* ───────────── Ventas ───────────── */

export async function instantSell(userId: string, kwInput: number) {
  const { econ } = await ensureReady();
  const now = Date.now();
  const kw = round1(kwInput);
  const pos = await getKwPosition(userId, now);
  if (kw < 0.1) throw new MarketError("Vende al menos 0,1 kW");
  if (kw > pos.availableKw) throw new MarketError(`Solo tienes ${pos.availableKw} kW disponibles para vender`);
  const avgCost = Math.round(pos.investedCop / pos.kw);
  const amountCop = Math.round(kw * econ.pricePerKwCop * econ.instantSellFactor);
  const txId = newId("tx-");
  await db.batch([
    db.insert(ledgerTx).values({
      id: txId,
      userId,
      kind: "venta_inmediata",
      status: "confirmada",
      kw,
      amountCop,
      asset: "COP",
      walletName: "Solaxy",
      txHash: simulatedTxHash(),
      createdAt: now,
      confirmedAt: now,
    }),
    db.insert(positionEntry).values({ id: newId("pe-"), userId, plantId: PLANT.id, kwDelta: -kw, pricePerKwCop: avgCost, ts: now, txId }),
  ]);
  return { kw, amountCop };
}

export async function createListing(userId: string, kwInput: number, pricePerKwCop: number) {
  const { econ } = await ensureReady();
  const kw = round1(kwInput);
  const pos = await getKwPosition(userId);
  if (kw < 0.1) throw new MarketError("Publica al menos 0,1 kW");
  if (kw > pos.availableKw) throw new MarketError(`Solo tienes ${pos.availableKw} kW disponibles`);
  const min = Math.round(econ.pricePerKwCop * 0.8);
  const max = Math.round(econ.pricePerKwCop * 1.25);
  if (pricePerKwCop < min || pricePerKwCop > max) throw new MarketError("El precio debe estar entre −20 % y +25 % del precio de la planta");
  const id = newId("lst-");
  await db.insert(listing).values({ id, sellerId: userId, plantId: PLANT.id, kw, pricePerKwCop: Math.round(pricePerKwCop), status: "activa", createdAt: Date.now() });
  return { id, kw, pricePerKwCop };
}

export async function cancelListing(userId: string, listingId: string) {
  await ensureReady();
  const res = await db
    .update(listing)
    .set({ status: "cancelada", closedAt: Date.now() })
    .where(and(eq(listing.id, listingId), eq(listing.sellerId, userId), eq(listing.status, "activa")))
    .returning({ id: listing.id });
  if (!res.length) throw new MarketError("Oferta no encontrada", 404);
  return { id: listingId };
}

/* ───────────── Retiros ───────────── */

const MIN_WITHDRAWAL = 20_000;

export async function createWithdrawal(input: { userId: string; amountCop: number; walletAddress: string; walletName: string; chainId: number | null }) {
  await ensureReady();
  const now = Date.now();
  const pos = await getKwPosition(input.userId, now);
  const bal = await getBalances(input.userId, pos.entries, now);
  const amountCop = Math.floor(input.amountCop);
  if (amountCop < MIN_WITHDRAWAL) throw new MarketError(`El retiro mínimo es de $ ${MIN_WITHDRAWAL.toLocaleString("es-CO")}`);
  if (amountCop > bal.balance) throw new MarketError("No tienes saldo suficiente");
  const rates = await getRates();
  const code = `RET-${orderCode().slice(4)}`;
  const message = buildWithdrawalMessage({ code, amountCop, walletAddress: input.walletAddress, createdAt: now });
  await db.insert(ledgerTx).values({
    id: code,
    userId: input.userId,
    kind: "retiro",
    status: "pendiente",
    amountCop,
    asset: "USDT",
    assetAmount: amountCop / rates.prices.USDT.cop,
    network: input.chainId === 1 ? "Ethereum (ERC-20)" : "BNB Smart Chain (BEP-20)",
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    walletName: input.walletName,
    message,
    createdAt: now,
  });
  return { withdrawalId: code, message, amountCop, assetAmount: amountCop / rates.prices.USDT.cop };
}

export async function confirmWithdrawal(userId: string, withdrawalId: string, signature: string) {
  const { settings } = await ensureReady();
  const now = Date.now();
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.id, withdrawalId), eq(ledgerTx.userId, userId), eq(ledgerTx.kind, "retiro")));
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  if (tx.status === "confirmada" || tx.status === "por_aprobar") return toTxDTO(tx);
  if (tx.status !== "pendiente" || now - tx.createdAt > ORDER_TTL_MS) throw new MarketError("Este retiro expiró", 410);
  const valid = await verifyWalletSignature({ address: tx.walletAddress ?? "", message: tx.message ?? "", signature });
  if (!valid) throw new MarketError("La firma no corresponde a la wallet de destino");
  const pos = await getKwPosition(userId, now);
  const bal = await getBalances(userId, pos.entries, now);
  if (tx.amountCop > bal.balance) throw new MarketError("No tienes saldo suficiente");
  if (settings.withdrawalApproval) {
    // Queda esperando al administrador; mientras tanto aparta el saldo.
    const res = await db
      .update(ledgerTx)
      .set({ status: "por_aprobar", signature })
      .where(and(eq(ledgerTx.id, withdrawalId), eq(ledgerTx.status, "pendiente")))
      .returning();
    if (!res.length) throw new MarketError("Este retiro ya se envió", 409);
    return toTxDTO(res[0]);
  }
  const txHash = simulatedTxHash();
  const res = await db
    .update(ledgerTx)
    .set({ status: "confirmada", signature, txHash, confirmedAt: now })
    .where(and(eq(ledgerTx.id, withdrawalId), eq(ledgerTx.status, "pendiente")))
    .returning();
  if (!res.length) throw new MarketError("Este retiro ya se envió", 409);
  return toTxDTO(res[0]);
}

export async function getWithdrawal(userId: string, withdrawalId: string) {
  await ensureReady();
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.id, withdrawalId), eq(ledgerTx.userId, userId), eq(ledgerTx.kind, "retiro")));
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  return toTxDTO(tx);
}

/* ───────────── Wallet vinculada ───────────── */

export async function linkWallet(userId: string, w: { address: string; walletName: string; chainId: number | null }) {
  await ensureReady();
  await db
    .insert(walletLink)
    .values({ userId, address: w.address, walletName: w.walletName, chainId: w.chainId, connectedAt: Date.now() })
    .onConflictDoUpdate({ target: walletLink.userId, set: { address: w.address, walletName: w.walletName, chainId: w.chainId, connectedAt: Date.now() } });
}
