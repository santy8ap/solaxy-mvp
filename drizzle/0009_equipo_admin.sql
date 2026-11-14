CREATE TABLE `admin_member` (
	`email` text PRIMARY KEY NOT NULL,
	`added_by` text NOT NULL,
	`added_at` integer NOT NULL,
	`note` text
);
