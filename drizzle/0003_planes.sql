CREATE TABLE `company_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`nit` text NOT NULL,
	`full_name` text NOT NULL,
	`doc_type` text NOT NULL,
	`doc_number` text NOT NULL,
	`phone` text NOT NULL,
	`city` text NOT NULL,
	`terms_version` text,
	`terms_accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plan_period` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`idx` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`kwh` real NOT NULL,
	`amount_cop` integer NOT NULL,
	`tx_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_period_sub_idx_uq` ON `plan_period` (`subscription_id`,`idx`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_period_tx_uq` ON `plan_period` (`tx_id`);--> statement-breakpoint
CREATE TABLE `plan_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`total_kwh` real NOT NULL,
	`months` integer NOT NULL,
	`daily_kwh` real NOT NULL,
	`price_cop_per_kwh` integer NOT NULL,
	`sale_cop_per_kwh` integer NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_sub_user_idx` ON `plan_subscription` (`user_id`);--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `subscription_id` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `period_index` integer;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `kwh` real;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `bank_name` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `bank_account_type` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `bank_account_number` text;--> statement-breakpoint
CREATE INDEX `tx_subscription_idx` ON `ledger_tx` (`subscription_id`);--> statement-breakpoint
ALTER TABLE `plant` ADD `peak_kw` real DEFAULT 8000 NOT NULL;--> statement-breakpoint
ALTER TABLE `plant` ADD `sale_cop_per_kwh` integer DEFAULT 400 NOT NULL;--> statement-breakpoint
ALTER TABLE `plant` ADD `plan_prices` text DEFAULT '{}' NOT NULL;
