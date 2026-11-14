CREATE INDEX `audit_target_idx` ON `admin_audit` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tx_kind_created_idx` ON `ledger_tx` (`kind`,`created_at`);