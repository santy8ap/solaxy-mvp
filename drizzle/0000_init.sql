CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_tx` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`kw` real,
	`amount_cop` integer NOT NULL,
	`asset` text,
	`asset_amount` real,
	`network` text,
	`chain_id` integer,
	`wallet_address` text,
	`wallet_name` text,
	`message` text,
	`signature` text,
	`tx_hash` text,
	`listing_id` text,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tx_user_idx` ON `ledger_tx` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `listing` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`plant_id` text NOT NULL,
	`kw` real NOT NULL,
	`price_per_kw_cop` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	`buyer_id` text,
	FOREIGN KEY (`seller_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listing_status_idx` ON `listing` (`status`);--> statement-breakpoint
CREATE TABLE `plant` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`capacity_kwp` real NOT NULL,
	`price_per_kw_cop` integer NOT NULL,
	`commissioned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `position_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plant_id` text NOT NULL,
	`kw_delta` real NOT NULL,
	`price_per_kw_cop` integer NOT NULL,
	`ts` integer NOT NULL,
	`tx_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `position_user_idx` ON `position_entry` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `telemetry` (
	`plant_id` text NOT NULL,
	`ts` integer NOT NULL,
	`day` integer NOT NULL,
	`solar_kw` real NOT NULL,
	`battery_kw` real NOT NULL,
	`soc_pct` real NOT NULL,
	`delivered_kwh` real NOT NULL,
	`irradiance` real NOT NULL,
	`module_temp_c` real NOT NULL,
	`ambient_temp_c` real NOT NULL,
	`tariff_cop` real NOT NULL,
	`net_cop` real NOT NULL,
	`cum_kwh` real NOT NULL,
	`cum_net_per_kwp` real NOT NULL,
	PRIMARY KEY(`plant_id`, `ts`)
);
--> statement-breakpoint
CREATE INDEX `telemetry_day_idx` ON `telemetry` (`plant_id`,`day`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `wallet_link` (
	`user_id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`wallet_name` text NOT NULL,
	`chain_id` integer,
	`connected_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
