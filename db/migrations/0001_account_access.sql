CREATE TABLE `account_invites` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('therapist','admin','owner') NOT NULL DEFAULT 'therapist',
	`plan` enum('free','pro') NOT NULL DEFAULT 'free',
	`invited_by_user_id` bigint unsigned NOT NULL,
	`used_by_user_id` bigint unsigned,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('therapist','client','admin','owner') NOT NULL;--> statement-breakpoint
ALTER TABLE `invites` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `therapist_profiles` ADD `plan` enum('free','pro') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `therapist_profiles` ADD `subscription_status` enum('active','trialing','past_due','cancelled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `therapist_profiles` ADD `subscription_ends_at` timestamp;