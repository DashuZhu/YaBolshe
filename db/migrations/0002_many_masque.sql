ALTER TABLE `account_invites` ADD `is_platform_owner` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_platform_owner` boolean DEFAULT false NOT NULL;