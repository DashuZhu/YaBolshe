ALTER TABLE `users` ADD `privacy_consent_at` timestamp;
--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_consent_version` varchar(32);
--> statement-breakpoint
ALTER TABLE `users` ADD `terms_accepted_at` timestamp;
--> statement-breakpoint
ALTER TABLE `users` ADD `terms_version` varchar(32);
