import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  /** Configuración editable por el administrador */
  tariffDayCop: integer("tariff_day_cop").notNull().default(560),
  tariffPeakCop: integer("tariff_peak_cop").notNull().default(820),
  /** Comisión de operación y plataforma, en % del ingreso */
  commissionPct: real("commission_pct").notNull().default(18),
  withdrawalApproval: integer("withdrawal_approval", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at"),
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

export const TX_KINDS = ["compra", "compra_p2p", "venta_p2p", "venta_inmediata", "retiro", "asignacion_demo", "ajuste_admin"] as const;
export const TX_STATUSES = ["pendiente", "verificando", "por_aprobar", "confirmada", "rechazada", "fallida", "cancelada"] as const;
/** Cómo se pagó una orden: firma simulada (solo modo demo), Wompi o cripto directo a la billetera de la empresa. */
export const PAYMENT_METHODS = ["demo", "wompi", "crypto"] as const;
export type TxKind = (typeof TX_KINDS)[number];
export type TxStatus = (typeof TX_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
    /** Motivo de un ajuste del admin o de un rechazo */
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    confirmedAt: integer("confirmed_at"),
    /** Pasarela de una compra (null en movimientos que no son pagos) */
    method: text("method", { enum: PAYMENT_METHODS }),
    /** Id del pago en el proveedor: transacción de Wompi o hash on-chain (en minúsculas) */
    providerId: text("provider_id"),
    /** Último estado reportado por el proveedor (APPROVED, PENDING, confirmaciones…) */
    providerStatus: text("provider_status"),
    /** Monto exacto esperado en unidades base, como texto: centavos de COP o wei del activo */
    expectedAmount: text("expected_amount"),
    /** Vigencia de la cotización (ms UTC) */
    expiresAt: integer("expires_at"),
  },
  (t) => [
    index("tx_user_idx").on(t.userId, t.createdAt),
    index("tx_method_status_idx").on(t.method, t.status),
    // Un mismo pago (transacción de Wompi u hash on-chain) no puede acreditarse dos veces.
    uniqueIndex("tx_provider_uq").on(t.method, t.providerId),
  ],
);

export const DOC_TYPES = ["CC", "CE", "PP", "NIT"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Datos del inversionista: obligatorios antes de la primera compra real. */
export const investorProfile = sqliteTable("investor_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  docType: text("doc_type", { enum: DOC_TYPES }).notNull(),
  docNumber: text("doc_number").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  /** Versión de los Términos y la Política de Datos aceptada, y cuándo */
  termsVersion: text("terms_version"),
  termsAcceptedAt: integer("terms_accepted_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

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

export const ADMIN_ACTIONS = ["ajuste_kw", "config_planta", "aprobar_retiro", "rechazar_retiro"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Bitácora de todo lo que hace un administrador. */
export const adminAudit = sqliteTable(
  "admin_audit",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action", { enum: ADMIN_ACTIONS }).notNull(),
    targetUserId: text("target_user_id"),
    summary: text("summary").notNull(),
    /** JSON con el valor anterior y el nuevo */
    detail: text("detail"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
