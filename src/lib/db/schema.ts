import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/* ───────────── Tablas de Better Auth (generadas con su generador para SQLite) ───────────── */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(nowMs)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(nowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ───────────── Dominio Solaxy ───────────── */

export const plant = sqliteTable("plant", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  capacityKwp: real("capacity_kwp").notNull(),
  pricePerKwCop: integer("price_per_kw_cop").notNull(),
  /** ms UTC */
  commissionedAt: integer("commissioned_at").notNull(),
});

/** Telemetría agregada cada 15 minutos. Los acumulados son al FINAL del intervalo. */
export const telemetry = sqliteTable(
  "telemetry",
  {
    plantId: text("plant_id").notNull(),
    ts: integer("ts").notNull(),
    day: integer("day").notNull(),
    solarKw: real("solar_kw").notNull(),
    batteryKw: real("battery_kw").notNull(),
    socPct: real("soc_pct").notNull(),
    deliveredKwh: real("delivered_kwh").notNull(),
    irradiance: real("irradiance").notNull(),
    moduleTempC: real("module_temp_c").notNull(),
    ambientTempC: real("ambient_temp_c").notNull(),
    tariffCop: real("tariff_cop").notNull(),
    netCop: real("net_cop").notNull(),
    cumKwh: real("cum_kwh").notNull(),
    cumNetPerKwp: real("cum_net_per_kwp").notNull(),
  },
  (t) => [primaryKey({ columns: [t.plantId, t.ts] }), index("telemetry_day_idx").on(t.plantId, t.day)],
);

export const positionEntry = sqliteTable(
  "position_entry",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plantId: text("plant_id").notNull(),
    /** + compra, − venta */
    kwDelta: real("kw_delta").notNull(),
    /** Costo por kW (en ventas: costo promedio de los kW vendidos) */
    pricePerKwCop: integer("price_per_kw_cop").notNull(),
    ts: integer("ts").notNull(),
    txId: text("tx_id"),
  },
  (t) => [index("position_user_idx").on(t.userId)],
);

export const TX_KINDS = ["compra", "compra_p2p", "venta_p2p", "venta_inmediata", "retiro", "asignacion_demo"] as const;
export const TX_STATUSES = ["pendiente", "confirmada", "fallida", "cancelada"] as const;
export type TxKind = (typeof TX_KINDS)[number];
export type TxStatus = (typeof TX_STATUSES)[number];

export const ledgerTx = sqliteTable(
  "ledger_tx",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: TX_KINDS }).notNull(),
    status: text("status", { enum: TX_STATUSES }).notNull(),
    kw: real("kw"),
    amountCop: integer("amount_cop").notNull(),
    asset: text("asset"),
    assetAmount: real("asset_amount"),
    network: text("network"),
    chainId: integer("chain_id"),
    walletAddress: text("wallet_address"),
    walletName: text("wallet_name"),
    message: text("message"),
    signature: text("signature"),
    txHash: text("tx_hash"),
    listingId: text("listing_id"),
    createdAt: integer("created_at").notNull(),
    confirmedAt: integer("confirmed_at"),
  },
  (t) => [index("tx_user_idx").on(t.userId, t.createdAt)],
);

export const LISTING_STATUSES = ["activa", "vendida", "cancelada"] as const;

export const listing = sqliteTable(
  "listing",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plantId: text("plant_id").notNull(),
    kw: real("kw").notNull(),
    pricePerKwCop: integer("price_per_kw_cop").notNull(),
    status: text("status", { enum: LISTING_STATUSES }).notNull(),
    createdAt: integer("created_at").notNull(),
    closedAt: integer("closed_at"),
    buyerId: text("buyer_id"),
  },
  (t) => [index("listing_status_idx").on(t.status)],
);

export const walletLink = sqliteTable("wallet_link", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  walletName: text("wallet_name").notNull(),
  chainId: integer("chain_id"),
  connectedAt: integer("connected_at").notNull(),
});

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
