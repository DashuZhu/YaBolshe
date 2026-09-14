CREATE TABLE `client_analysis` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`portrait_summary` text,
	`dynamics_summary` text,
	`recurring_themes_json` json,
	`avoided_by_client_json` json,
	`avoided_by_therapist_json` json,
	`sessions_analyzed` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_analysis_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_analysis_client_id_unique` UNIQUE(`client_id`)
);
--> statement-breakpoint
CREATE TABLE `session_files` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`kind` enum('audio_video','text') NOT NULL,
	`speaker_hint` enum('therapist','client','unknown') NOT NULL DEFAULT 'unknown',
	`file_path` varchar(512) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`size_bytes` bigint NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `contact_email` varchar(320);--> statement-breakpoint
ALTER TABLE `sessions` ADD `client_progress_note` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `emotions_needs_analysis` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `case_analysis` text;--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_consent_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_consent_version` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `terms_accepted_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `terms_version` varchar(32);