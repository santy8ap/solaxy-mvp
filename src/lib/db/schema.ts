import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/* ───────────── Dominio: planes de energía ───────────── */

/** La planta y los precios vigentes (una sola fila). Los edita el administrador. */
export const plant = sqliteTable("plant", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  /** Potencia máxima de la curva solar (kW) */
  peakKw: real("peak_kw").notNull().default(8000),
  /** Precio al que se vende toda la energía (COP por kWh) */
  saleCopPerKwh: integer("sale_cop_per_kwh").notNull().default(400),
  /** JSON { [idDelPlan]: precio por kWh }. Lo que falte usa el valor de config/plans.ts */
  planPrices: text("plan_prices").notNull().default("{}"),
  updatedAt: integer("updated_at"),
});

/**
 * Un plan de energía comprado por una empresa. Guarda las condiciones con las que se compró:
 * un cambio de precios solo aplica a planes nuevos. Sin periodos es un borrador (no se ha pagado).
 */
export const planSubscription = sqliteTable(
  "plan_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    planName: text("plan_name").notNull(),
    totalKwh: real("total_kwh").notNull(),
    months: integer("months").notNull(),
    dailyKwh: real("daily_kwh").notNull(),
    priceCopPerKwh: integer("price_cop_per_kwh").notNull(),
    saleCopPerKwh: integer("sale_cop_per_kwh").notNull(),
    createdAt: integer("created_at").notNull(),
    /** Cuándo se confirmó el primer pago */
    startedAt: integer("started_at"),
    /** Cierre anticipado por el administrador */
    cancelledAt: integer("cancelled_at"),
  },
  (t) => [index("plan_sub_user_idx").on(t.userId)],
);

/** Un mes pagado de un plan: 30 días de energía. */
export const planPeriod = sqliteTable(
  "plan_period",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => planSubscription.id, { onDelete: "cascade" }),
    /** Mes del plan: 1, 2, 3… */
    idx: integer("idx").notNull(),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    kwh: real("kwh").notNull(),
    amountCop: integer("amount_cop").notNull(),
    /** Pago que lo activó */
    txId: text("tx_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    // Un mes no se activa dos veces, y un pago no activa dos meses.
    uniqueIndex("plan_period_sub_idx_uq").on(t.subscriptionId, t.idx),
    uniqueIndex("plan_period_tx_uq").on(t.txId),
  ],
);

/** plan_mes: pago de un mes de un plan. retiro: la empresa retira su saldo. */
export const TX_KINDS = ["plan_mes", "retiro"] as const;
/** por_reembolsar: el pago llegó pero no se pudo activar (sin cupo, mes ya pagado, monto distinto); reembolsada: el admin ya lo devolvió. */
export const TX_STATUSES = ["pendiente", "verificando", "por_aprobar", "confirmada", "rechazada", "fallida", "cancelada", "por_reembolsar", "reembolsada"] as const;
/** Cómo se pagó: Mercado Pago, cripto directo a la billetera de la empresa, pago registrado por el admin o pago de prueba (solo en modo de pruebas). */
export const PAYMENT_METHODS = ["demo", "mercadopago", "crypto", "manual"] as const;
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
    /** Motivo de un rechazo o de un pago que no se pudo activar */
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    confirmedAt: integer("confirmed_at"),
    /** Pasarela de un pago (null en los retiros) */
    method: text("method", { enum: PAYMENT_METHODS }),
    /** Id del pago en el proveedor: pago de Mercado Pago, hash on-chain (en minúsculas) o referencia del pago manual */
    providerId: text("provider_id"),
    /** Último estado reportado por el proveedor (approved, pending, confirmaciones…) */
    providerStatus: text("provider_status"),
    /** Monto exacto esperado, como texto: pesos (Mercado Pago) o wei del activo (cripto) */
    expectedAmount: text("expected_amount"),
    /** Vigencia de la cotización (ms UTC) */
    expiresAt: integer("expires_at"),
    /** Plan y mes que paga una orden plan_mes */
    subscriptionId: text("subscription_id"),
    periodIndex: integer("period_index"),
    /** Energía del mes pagado (kWh) */
    kwh: real("kwh"),
    /** Retiro a una cuenta bancaria a nombre de la empresa */
    bankName: text("bank_name"),
    bankAccountType: text("bank_account_type"),
    bankAccountNumber: text("bank_account_number"),
  },
  (t) => [
    index("tx_user_idx").on(t.userId, t.createdAt),
    index("tx_method_status_idx").on(t.method, t.status),
    index("tx_subscription_idx").on(t.subscriptionId),
    // Un mismo pago (de Mercado Pago, hash on-chain o referencia manual) no puede acreditarse dos veces.
    uniqueIndex("tx_provider_uq").on(t.method, t.providerId),
  ],
);

/** Documento del representante legal. */
export const DOC_TYPES = ["CC", "CE", "PP"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Datos de la empresa: obligatorios antes del primer pago. */
export const companyProfile = sqliteTable("company_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Razón social */
  companyName: text("company_name").notNull(),
  /** NIT con dígito de verificación: 900123456-8 */
  nit: text("nit").notNull(),
  /** Representante legal */
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

export const ADMIN_ACTIONS = ["config_planta", "pago_manual", "cerrar_plan", "aprobar_retiro", "rechazar_retiro", "reverificar_pago", "registrar_hash", "marcar_reembolso", "borrar_datos_prueba"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Bitácora de todo lo que hace un administrador. */
export const adminAudit = sqliteTable(
  "admin_audit",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").$type<AdminAction>().notNull(),
    targetUserId: text("target_user_id"),
    summary: text("summary").notNull(),
    /** JSON con el valor anterior y el nuevo */
    detail: text("detail"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
