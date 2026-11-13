CREATE TABLE `customer_email` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_email_user_idx` ON `customer_email` (`user_id`,`created_at`);