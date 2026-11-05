CREATE TABLE `investor_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
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
ALTER TABLE `ledger_tx` ADD `method` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `provider_id` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `provider_status` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `expected_amount` text;--> statement-breakpoint
ALTER TABLE `ledger_tx` ADD `expires_at` integer;--> statement-breakpoint
CREATE INDEX `tx_method_status_idx` ON `ledger_tx` (`method`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `tx_provider_uq` ON `ledger_tx` (`method`,`provider_id`);