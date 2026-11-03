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
  }
];
