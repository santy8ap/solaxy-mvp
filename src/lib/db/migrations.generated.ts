// Archivo generado por scripts/embed-migrations.mjs — no editar a mano.
export const MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    "id": "0000_init",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `account` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`account_id` text NOT NULL,\n\t`provider_id` text NOT NULL,\n\t`user_id` text NOT NULL,\n\t`access_token` text,\n\t`refresh_token` text,\n\t`id_token` text,\n\t`access_token_expires_at` integer,\n\t`refresh_token_expires_at` integer,\n\t`scope` text,\n\t`password` text,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `account_userId_idx` ON `account` (`user_id`);",
      "CREATE TABLE IF NOT EXISTS `app_meta` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL\n);",
      "CREATE TABLE IF NOT EXISTS `ledger_tx` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`status` text NOT NULL,\n\t`kw` real,\n\t`amount_cop` integer NOT NULL,\n\t`asset` text,\n\t`asset_amount` real,\n\t`network` text,\n\t`chain_id` integer,\n\t`wallet_address` text,\n\t`wallet_name` text,\n\t`message` text,\n\t`signature` text,\n\t`tx_hash` text,\n\t`listing_id` text,\n\t`created_at` integer NOT NULL,\n\t`confirmed_at` integer,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `tx_user_idx` ON `ledger_tx` (`user_id`,`created_at`);",
      "CREATE TABLE IF NOT EXISTS `listing` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`seller_id` text NOT NULL,\n\t`plant_id` text NOT NULL,\n\t`kw` real NOT NULL,\n\t`price_per_kw_cop` integer NOT NULL,\n\t`status` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\t`closed_at` integer,\n\t`buyer_id` text,\n\tFOREIGN KEY (`seller_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `listing_status_idx` ON `listing` (`status`);",
      "CREATE TABLE IF NOT EXISTS `plant` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`location` text NOT NULL,\n\t`capacity_kwp` real NOT NULL,\n\t`price_per_kw_cop` integer NOT NULL,\n\t`commissioned_at` integer NOT NULL\n);",
      "CREATE TABLE IF NOT EXISTS `position_entry` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`plant_id` text NOT NULL,\n\t`kw_delta` real NOT NULL,\n\t`price_per_kw_cop` integer NOT NULL,\n\t`ts` integer NOT NULL,\n\t`tx_id` text,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `position_user_idx` ON `position_entry` (`user_id`);",
      "CREATE TABLE IF NOT EXISTS `session` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`expires_at` integer NOT NULL,\n\t`token` text NOT NULL,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer NOT NULL,\n\t`ip_address` text,\n\t`user_agent` text,\n\t`user_id` text NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);",
      "CREATE INDEX IF NOT EXISTS `session_userId_idx` ON `session` (`user_id`);",
      "CREATE TABLE IF NOT EXISTS `telemetry` (\n\t`plant_id` text NOT NULL,\n\t`ts` integer NOT NULL,\n\t`day` integer NOT NULL,\n\t`solar_kw` real NOT NULL,\n\t`battery_kw` real NOT NULL,\n\t`soc_pct` real NOT NULL,\n\t`delivered_kwh` real NOT NULL,\n\t`irradiance` real NOT NULL,\n\t`module_temp_c` real NOT NULL,\n\t`ambient_temp_c` real NOT NULL,\n\t`tariff_cop` real NOT NULL,\n\t`net_cop` real NOT NULL,\n\t`cum_kwh` real NOT NULL,\n\t`cum_net_per_kwp` real NOT NULL,\n\tPRIMARY KEY(`plant_id`, `ts`)\n);",
      "CREATE INDEX IF NOT EXISTS `telemetry_day_idx` ON `telemetry` (`plant_id`,`day`);",
      "CREATE TABLE IF NOT EXISTS `user` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`email` text NOT NULL,\n\t`email_verified` integer DEFAULT false NOT NULL,\n\t`image` text,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL\n);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);",
      "CREATE TABLE IF NOT EXISTS `verification` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`identifier` text NOT NULL,\n\t`value` text NOT NULL,\n\t`expires_at` integer NOT NULL,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL\n);",
      "CREATE INDEX IF NOT EXISTS `verification_identifier_idx` ON `verification` (`identifier`);",
      "CREATE TABLE IF NOT EXISTS `wallet_link` (\n\t`user_id` text PRIMARY KEY NOT NULL,\n\t`address` text NOT NULL,\n\t`wallet_name` text NOT NULL,\n\t`chain_id` integer,\n\t`connected_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);"
    ]
  },
  {
    "id": "0001_admin",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `admin_audit` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`actor_user_id` text NOT NULL,\n\t`actor_name` text NOT NULL,\n\t`action` text NOT NULL,\n\t`target_user_id` text,\n\t`summary` text NOT NULL,\n\t`detail` text,\n\t`created_at` integer NOT NULL\n);",
      "CREATE INDEX IF NOT EXISTS `audit_created_idx` ON `admin_audit` (`created_at`);",
      "ALTER TABLE `ledger_tx` ADD `note` text;",
      "ALTER TABLE `plant` ADD `tariff_day_cop` integer DEFAULT 560 NOT NULL;",
      "ALTER TABLE `plant` ADD `tariff_peak_cop` integer DEFAULT 820 NOT NULL;",
      "ALTER TABLE `plant` ADD `commission_pct` real DEFAULT 18 NOT NULL;",
      "ALTER TABLE `plant` ADD `withdrawal_approval` integer DEFAULT true NOT NULL;",
      "ALTER TABLE `plant` ADD `updated_at` integer;"
    ]
  },
  {
    "id": "0002_pagos",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `investor_profile` (\n\t`user_id` text PRIMARY KEY NOT NULL,\n\t`full_name` text NOT NULL,\n\t`doc_type` text NOT NULL,\n\t`doc_number` text NOT NULL,\n\t`phone` text NOT NULL,\n\t`city` text NOT NULL,\n\t`terms_version` text,\n\t`terms_accepted_at` integer,\n\t`created_at` integer NOT NULL,\n\t`updated_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "ALTER TABLE `ledger_tx` ADD `method` text;",
      "ALTER TABLE `ledger_tx` ADD `provider_id` text;",
      "ALTER TABLE `ledger_tx` ADD `provider_status` text;",
      "ALTER TABLE `ledger_tx` ADD `expected_amount` text;",
      "ALTER TABLE `ledger_tx` ADD `expires_at` integer;",
      "CREATE INDEX IF NOT EXISTS `tx_method_status_idx` ON `ledger_tx` (`method`,`status`);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `tx_provider_uq` ON `ledger_tx` (`method`,`provider_id`);"
    ]
  },
  {
    "id": "0003_planes",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `company_profile` (\n\t`user_id` text PRIMARY KEY NOT NULL,\n\t`company_name` text NOT NULL,\n\t`nit` text NOT NULL,\n\t`full_name` text NOT NULL,\n\t`doc_type` text NOT NULL,\n\t`doc_number` text NOT NULL,\n\t`phone` text NOT NULL,\n\t`city` text NOT NULL,\n\t`terms_version` text,\n\t`terms_accepted_at` integer,\n\t`created_at` integer NOT NULL,\n\t`updated_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE TABLE IF NOT EXISTS `plan_period` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`subscription_id` text NOT NULL,\n\t`idx` integer NOT NULL,\n\t`starts_at` integer NOT NULL,\n\t`ends_at` integer NOT NULL,\n\t`kwh` real NOT NULL,\n\t`amount_cop` integer NOT NULL,\n\t`tx_id` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `plan_period_sub_idx_uq` ON `plan_period` (`subscription_id`,`idx`);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `plan_period_tx_uq` ON `plan_period` (`tx_id`);",
      "CREATE TABLE IF NOT EXISTS `plan_subscription` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`plan_id` text NOT NULL,\n\t`plan_name` text NOT NULL,\n\t`total_kwh` real NOT NULL,\n\t`months` integer NOT NULL,\n\t`daily_kwh` real NOT NULL,\n\t`price_cop_per_kwh` integer NOT NULL,\n\t`sale_cop_per_kwh` integer NOT NULL,\n\t`created_at` integer NOT NULL,\n\t`started_at` integer,\n\t`cancelled_at` integer,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `plan_sub_user_idx` ON `plan_subscription` (`user_id`);",
      "ALTER TABLE `ledger_tx` ADD `subscription_id` text;",
      "ALTER TABLE `ledger_tx` ADD `period_index` integer;",
      "ALTER TABLE `ledger_tx` ADD `kwh` real;",
      "ALTER TABLE `ledger_tx` ADD `bank_name` text;",
      "ALTER TABLE `ledger_tx` ADD `bank_account_type` text;",
      "ALTER TABLE `ledger_tx` ADD `bank_account_number` text;",
      "CREATE INDEX IF NOT EXISTS `tx_subscription_idx` ON `ledger_tx` (`subscription_id`);",
      "ALTER TABLE `plant` ADD `peak_kw` real DEFAULT 8000 NOT NULL;",
      "ALTER TABLE `plant` ADD `sale_cop_per_kwh` integer DEFAULT 400 NOT NULL;",
      "ALTER TABLE `plant` ADD `plan_prices` text DEFAULT '{}' NOT NULL;"
    ]
  },
  {
    "id": "0003_rate_limit",
    "statements": [
      "-- Contadores de rate limiting persistentes en BD (funcionan entre instancias de Vercel).\nCREATE TABLE IF NOT EXISTS `rate_limit` (\n\t`rl_key` text NOT NULL,\n\t`window_start` integer NOT NULL,\n\t`count` integer NOT NULL DEFAULT 1,\n\tPRIMARY KEY(`rl_key`, `window_start`)\n);",
      "CREATE INDEX IF NOT EXISTS `rate_limit_key_idx` ON `rate_limit` (`rl_key`);"
    ]
  },
  {
    "id": "0004_limpieza",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `legacy_ledger_tx` AS SELECT * FROM `ledger_tx`;",
      "CREATE TABLE IF NOT EXISTS `legacy_position_entry` AS SELECT * FROM `position_entry`;",
      "DELETE FROM `ledger_tx` WHERE coalesce(`kw`, 0) = coalesce(`kw`, 0);",
      "DELETE FROM `session` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `email` LIKE '%solaxy.local');",
      "DELETE FROM `account` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `email` LIKE '%solaxy.local');",
      "DELETE FROM `wallet_link` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `email` LIKE '%solaxy.local');",
      "DELETE FROM `user` WHERE `email` LIKE '%solaxy.local';",
      "INSERT OR IGNORE INTO `company_profile` (`user_id`, `company_name`, `nit`, `full_name`, `doc_type`, `doc_number`, `phone`, `city`, `terms_version`, `terms_accepted_at`, `created_at`, `updated_at`)\nSELECT `user_id`,\n\tCASE WHEN `doc_type` = 'NIT' THEN `full_name` ELSE '' END,\n\tCASE WHEN `doc_type` = 'NIT' THEN `doc_number` ELSE '' END,\n\tCASE WHEN `doc_type` = 'NIT' THEN '' ELSE `full_name` END,\n\tCASE WHEN `doc_type` = 'NIT' THEN 'CC' ELSE `doc_type` END,\n\tCASE WHEN `doc_type` = 'NIT' THEN '' ELSE `doc_number` END,\n\t`phone`, `city`, `terms_version`, `terms_accepted_at`, `created_at`, `updated_at`\nFROM `investor_profile`\nWHERE `user_id` NOT IN (SELECT `id` FROM `user` WHERE `email` LIKE '%solaxy.local');",
      "DROP TABLE `investor_profile`;",
      "DROP TABLE `listing`;",
      "DROP TABLE `position_entry`;",
      "DROP TABLE `telemetry`;",
      "ALTER TABLE `ledger_tx` DROP COLUMN `kw`;",
      "ALTER TABLE `ledger_tx` DROP COLUMN `listing_id`;",
      "ALTER TABLE `plant` DROP COLUMN `capacity_kwp`;",
      "ALTER TABLE `plant` DROP COLUMN `price_per_kw_cop`;",
      "ALTER TABLE `plant` DROP COLUMN `commissioned_at`;",
      "ALTER TABLE `plant` DROP COLUMN `tariff_day_cop`;",
      "ALTER TABLE `plant` DROP COLUMN `tariff_peak_cop`;",
      "ALTER TABLE `plant` DROP COLUMN `commission_pct`;",
      "ALTER TABLE `plant` DROP COLUMN `withdrawal_approval`;",
      "UPDATE `plant` SET `name` = 'Planta Solar I' WHERE `name` = 'Solaxy Solar I';"
    ]
  },
  {
    "id": "0005_customer_support",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `service_setting` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL,\n\t`updated_at` integer NOT NULL\n);"
    ]
  },
  {
    "id": "0006_payment_reconciliation",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `job_state` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`lock_token` text NOT NULL,\n\t`locked_until` integer NOT NULL,\n\t`cursor` text,\n\t`updated_at` integer NOT NULL\n);",
      "CREATE TABLE IF NOT EXISTS `payment_review` (\n\t`payment_id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`subscription_id` text NOT NULL,\n\t`occurred_at` integer NOT NULL,\n\t`reason` text NOT NULL,\n\t`resolved_at` integer,\n\t`resolution_reference` text,\n\tFOREIGN KEY (`payment_id`) REFERENCES `ledger_tx`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `payment_review_user_idx` ON `payment_review` (`user_id`,`resolved_at`);"
    ]
  }
];
