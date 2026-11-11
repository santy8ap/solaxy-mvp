CREATE TABLE `job_state` (
	`id` text PRIMARY KEY NOT NULL,
	`lock_token` text NOT NULL,
	`locked_until` integer NOT NULL,
	`cursor` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_review` (
	`payment_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`reason` text NOT NULL,
	`resolved_at` integer,
	`resolution_reference` text,
	FOREIGN KEY (`payment_id`) REFERENCES `ledger_tx`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_review_user_idx` ON `payment_review` (`user_id`,`resolved_at`);