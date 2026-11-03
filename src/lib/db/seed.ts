import "server-only";
import { eq } from "drizzle-orm";
import { ECONOMICS } from "@/config/economics";
import { PLANT } from "@/config/plant";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { REFERENCE_PRICES, type Asset } from "@/lib/rates";
import { DAY_MS, HOUR_MS, dayStartMs, localDayIndex } from "@/lib/sim";
import type { Db } from "./client";
import { ledgerTx, listing, plant, positionEntry, user } from "./schema";

/** PRNG determinista: la demo siempre arranca con los mismos datos. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Laura", "Andrés", "Camila", "Santiago", "Valentina", "Juan", "Mariana", "Sebastián", "Daniela", "Felipe",
  "Isabella", "Nicolás", "Sara", "Mateo", "Luisa", "Alejandro", "Paula", "Tomás", "Natalia", "David",
  "Gabriela", "Samuel", "Manuela", "Esteban", "Juliana", "Miguel", "Antonia", "Simón", "Catalina", "Emilio",
  "Verónica", "Óscar", "Carolina", "Ricardo", "Diana", "Jorge", "Lucía", "Martín", "Ana", "Pablo",
];
const LAST = "AMRGOPLCVHTBSFQJEKZDNW".split("");
const WALLETS = ["Trust Wallet", "Trust Wallet", "Trust Wallet", "MetaMask", "MetaMask", "WalletConnect"];
const ASSET_POOL: { asset: Asset; network: string; chainId: number | null }[] = [
  { asset: "USDT", network: "BNB Smart Chain (BEP-20)", chainId: 56 },
  { asset: "USDT", network: "BNB Smart Chain (BEP-20)", chainId: 56 },
  { asset: "USDT", network: "BNB Smart Chain (BEP-20)", chainId: 56 },
  { asset: "USDT", network: "Ethereum (ERC-20)", chainId: 1 },
  { asset: "BNB", network: "BNB Smart Chain", chainId: 56 },
  { asset: "ETH", network: "Ethereum", chainId: 1 },
  { asset: "BTC", network: "Bitcoin", chainId: null },
];

export const INVESTOR_COUNT = 140;
export const INVESTOR_TOTAL_KW = 1150;

export async function seed(db: Db, now = Date.now()) {
  const rnd = mulberry32(PLANT.seed);
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");
  const fakeAddress = () => `0x${hex(40)}`;
  const fakeHash = () => `0x${hex(64)}`;
  const price = ECONOMICS.pricePerKwCop;
  const commissionedAt = dayStartMs(localDayIndex(now) - PLANT.commissionedDaysAgo);

  await db
    .insert(plant)
    .values({
      id: PLANT.id,
      name: PLANT.name,
      location: PLANT.location,
      capacityKwp: PLANT.capacityKwp,
      pricePerKwCop: price,
      commissionedAt,
    })
    .onConflictDoNothing();

  // Inversionistas de la comunidad (ficticios, no pueden iniciar sesión).
  const raw = Array.from({ length: INVESTOR_COUNT }, () => 0.5 + 24 * rnd() ** 3);
  const scale = INVESTOR_TOTAL_KW / raw.reduce((s, k) => s + k, 0);
  const investors: { id: string; kw: number }[] = [];
  const txRows: (typeof ledgerTx.$inferInsert)[] = [];
  const entryRows: (typeof positionEntry.$inferInsert)[] = [];
  const span = now - commissionedAt - DAY_MS;

  for (let i = 0; i < INVESTOR_COUNT; i++) {
    const id = `inv-${String(i + 1).padStart(3, "0")}`;
    const kw = Math.max(0.5, Math.round(raw[i] * scale * 10) / 10);
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}.`;
    const joined = commissionedAt + DAY_MS / 2 + span * Math.sqrt(rnd());
    await db
      .insert(user)
      .values({ id, name, email: `${id}@comunidad.solaxy.local`, emailVerified: false, createdAt: new Date(joined), updatedAt: new Date(joined) })
      .onConflictDoNothing();

    const lots = kw >= 3 && rnd() < 0.4 ? [Math.round(kw * 6) / 10, Math.round(kw * 4) / 10] : [kw];
    let t = joined;
    for (const lotKw of lots) {
      const pay = ASSET_POOL[Math.floor(rnd() * ASSET_POOL.length)];
      const amountCop = Math.round(lotKw * price);
      const txId = `seed-tx-${id}-${Math.round(t)}`;
      txRows.push({
        id: txId,
        userId: id,
        kind: "compra",
        status: "confirmada",
        kw: lotKw,
        amountCop,
        asset: pay.asset,
        assetAmount: amountCop / REFERENCE_PRICES[pay.asset].cop,
        network: pay.network,
        chainId: pay.chainId,
        walletAddress: pay.asset === "BTC" ? `bc1q${hex(38)}` : fakeAddress(),
        walletName: pay.asset === "BTC" ? "Trust Wallet" : WALLETS[Math.floor(rnd() * WALLETS.length)],
        txHash: pay.asset === "BTC" ? hex(64) : fakeHash(),
        createdAt: Math.round(t),
        confirmedAt: Math.round(t + 90_000),
      });
      entryRows.push({ id: `seed-pe-${id}-${Math.round(t)}`, userId: id, plantId: PLANT.id, kwDelta: lotKw, pricePerKwCop: price, ts: Math.round(t), txId });
      t = Math.min(now - HOUR_MS, t + (now - t) * rnd() * 0.8);
    }
    investors.push({ id, kw });
  }

  // Ofertas activas en el mercado P2P.
  const sellers = investors.filter((v) => v.kw >= 1.5).slice(3, 9);
  const listingRows = sellers.map((s, k) => ({
    id: `seed-listing-${k + 1}`,
    sellerId: s.id,
    plantId: PLANT.id,
    kw: Math.round(Math.min(s.kw * 0.5, 6) * 10) / 10,
    pricePerKwCop: 4_650_000 + Math.round(rnd() * 8) * 50_000,
    status: "activa" as const,
    createdAt: Math.round(now - rnd() * 5 * DAY_MS),
  }));

  // Cuenta demo: 7 kW hace 90 días + 5 kW hace 28 días + un retiro.
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, env.demoEmail));
  let demoId = existing[0]?.id;
  if (!demoId) {
    const res = await auth.api.signUpEmail({ body: { name: env.demoName, email: env.demoEmail, password: env.demoPassword } });
    demoId = res.user.id;
  }
  const demoAddress = fakeAddress();
  const lot1 = dayStartMs(localDayIndex(now) - 90) + 10.4 * HOUR_MS;
  const lot2 = dayStartMs(localDayIndex(now) - 28) + 15.2 * HOUR_MS;
  const withdrawAt = dayStartMs(localDayIndex(now) - 9) + 11.7 * HOUR_MS;
  for (const [k, lot] of [
    [7, lot1],
    [5, lot2],
  ] as const) {
    const txId = `seed-demo-${k}kw`;
    const amountCop = Math.round(k * price);
    txRows.push({
      id: txId,
      userId: demoId,
      kind: "compra",
      status: "confirmada",
      kw: k,
      amountCop,
      asset: "USDT",
      assetAmount: amountCop / REFERENCE_PRICES.USDT.cop,
      network: "BNB Smart Chain (BEP-20)",
      chainId: 56,
      walletAddress: demoAddress,
      walletName: "Trust Wallet",
      txHash: fakeHash(),
      createdAt: Math.round(lot),
      confirmedAt: Math.round(lot + 75_000),
    });
    entryRows.push({ id: `seed-demo-pe-${k}`, userId: demoId, plantId: PLANT.id, kwDelta: k, pricePerKwCop: price, ts: Math.round(lot), txId });
  }
  txRows.push({
    id: "seed-demo-retiro",
    userId: demoId,
    kind: "retiro",
    status: "confirmada",
    amountCop: 350_000,
    asset: "USDT",
    assetAmount: 350_000 / REFERENCE_PRICES.USDT.cop,
    network: "BNB Smart Chain (BEP-20)",
    chainId: 56,
    walletAddress: demoAddress,
    walletName: "Trust Wallet",
    txHash: fakeHash(),
    createdAt: Math.round(withdrawAt),
    confirmedAt: Math.round(withdrawAt + 60_000),
  });

  for (let k = 0; k < txRows.length; k += 100) await db.insert(ledgerTx).values(txRows.slice(k, k + 100)).onConflictDoNothing();
  for (let k = 0; k < entryRows.length; k += 100) {
    await db.insert(positionEntry).values(entryRows.slice(k, k + 100)).onConflictDoNothing();
  }
  if (listingRows.length) await db.insert(listing).values(listingRows).onConflictDoNothing();

  return { commissionedAt, demoId };
}
