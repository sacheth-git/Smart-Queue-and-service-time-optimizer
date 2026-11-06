CREATE TABLE `counters` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`label` text NOT NULL,
	`is_open` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `historical_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`arrived_at` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`weekday` integer NOT NULL,
	`hour` integer NOT NULL,
	`wait_min` real NOT NULL,
	`service_min` real NOT NULL,
	`counters_open` integer NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`default_minutes` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `token_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` text NOT NULL,
	`type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`service_id` text NOT NULL,
	`status` text NOT NULL,
	`suggested_priority` text,
	`reasons_json` text,
	`item_codes_json` text,
	`confirmed_priority` text DEFAULT 'routine' NOT NULL,
	`triage_reviewed_at` integer,
	`counter_id` text,
	`checked_in_at` integer NOT NULL,
	`called_at` integer,
	`started_at` integer,
	`finished_at` integer,
	`ended_early` integer DEFAULT 0 NOT NULL,
	`est_low_min` integer,
	`est_high_min` integer,
	`est_mid_min` real,
	`idempotency_key` text,
	`phone_last4` text NOT NULL,
	`phone_hash` text,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counter_id`) REFERENCES `counters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_code_unique` ON `tokens` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_idempotency_key_unique` ON `tokens` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_active_phone_service` ON `tokens` (`phone_hash`,`service_id`) WHERE status IN ('waiting','called','serving');--> statement-breakpoint
CREATE TABLE `triage_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_code` text NOT NULL,
	`suggested` text,
	`reasons_json` text,
	`decision` text NOT NULL,
	`override_reason` text,
	`staff_label` text NOT NULL,
	`at` integer NOT NULL
);
