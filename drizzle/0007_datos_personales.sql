CREATE TABLE `data_request` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`resolved_at` integer,
	`resolution` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_request_user_idx` ON `data_request` (`user_id`);--> statement-breakpoint
CREATE INDEX `data_request_status_idx` ON `data_request` (`status`);