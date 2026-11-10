CREATE TABLE IF NOT EXISTS `legacy_ledger_tx` AS SELECT * FROM `ledger_tx`;--> statement-breakpoint
DELETE FROM `ledger_tx` WHERE coalesce(`kw`, 0) = coalesce(`kw`, 0);--> statement-breakpoint
DELETE FROM `session` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `email` LIKE '%@comunidad.solaxy.local');--> statement-breakpoint
DELETE FROM `account` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `email` LIKE '%@comunidad.solaxy.local');--> statement-breakpoint
DELETE FROM `wallet_link` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `email` LIKE '%@comunidad.solaxy.local');--> statement-breakpoint
DELETE FROM `user` WHERE `email` LIKE '%@comunidad.solaxy.local';--> statement-breakpoint
INSERT OR IGNORE INTO `company_profile` (`user_id`, `company_name`, `nit`, `full_name`, `doc_type`, `doc_number`, `phone`, `city`, `terms_version`, `terms_accepted_at`, `created_at`, `updated_at`)
SELECT `user_id`,
	CASE WHEN `doc_type` = 'NIT' THEN `full_name` ELSE '' END,
	CASE WHEN `doc_type` = 'NIT' THEN `doc_number` ELSE '' END,
	CASE WHEN `doc_type` = 'NIT' THEN '' ELSE `full_name` END,
	CASE WHEN `doc_type` = 'NIT' THEN 'CC' ELSE `doc_type` END,
	CASE WHEN `doc_type` = 'NIT' THEN '' ELSE `doc_number` END,
	`phone`, `city`, `terms_version`, `terms_accepted_at`, `created_at`, `updated_at`
FROM `investor_profile`
WHERE `user_id` NOT IN (SELECT `id` FROM `user` WHERE `email` LIKE '%@comunidad.solaxy.local');--> statement-breakpoint
DROP TABLE `investor_profile`;--> statement-breakpoint
DROP TABLE `listing`;--> statement-breakpoint
DROP TABLE `position_entry`;--> statement-breakpoint
DROP TABLE `telemetry`;--> statement-breakpoint
ALTER TABLE `ledger_tx` DROP COLUMN `kw`;--> statement-breakpoint
ALTER TABLE `ledger_tx` DROP COLUMN `listing_id`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `capacity_kwp`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `price_per_kw_cop`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `commissioned_at`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `tariff_day_cop`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `tariff_peak_cop`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `commission_pct`;--> statement-breakpoint
ALTER TABLE `plant` DROP COLUMN `withdrawal_approval`;