CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`summary` text NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `admin_audit` (`created_at`);--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `note` text;--> statement-breakpoint
ALTER TABLE `plant` ADD `tariff_day_cop` integer DEFAULT 560 NOT NULL;--> statement-breakpoint
ALTER TABLE `plant` ADD `tariff_peak_cop` integer DEFAULT 820 NOT NULL;--> statement-breakpoint
ALTER TABLE `plant` ADD `commission_pct` real DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE `plant` ADD `withdrawal_approval` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `plant` ADD `updated_at` integer;