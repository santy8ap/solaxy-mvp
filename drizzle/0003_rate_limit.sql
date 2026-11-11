-- Contadores de rate limiting persistentes en BD (funcionan entre instancias de Vercel).
CREATE TABLE IF NOT EXISTS `rate_limit` (
	`rl_key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`rl_key`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rate_limit_key_idx` ON `rate_limit` (`rl_key`);