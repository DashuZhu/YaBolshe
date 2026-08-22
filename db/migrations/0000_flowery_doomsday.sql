CREATE TABLE `agreements` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`session_id` bigint unsigned,
	`text` text NOT NULL,
	`type` enum('installation','agreement','rule','intention','experiment') NOT NULL DEFAULT 'agreement',
	`status` enum('active','review','completed') NOT NULL DEFAULT 'active',
	`review_date` varchar(60) NOT NULL DEFAULT '',
	`approved` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agreements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`actor_id` bigint unsigned,
	`actor_name` varchar(200) NOT NULL DEFAULT 'system',
	`action` varchar(120) NOT NULL,
	`entity_type` varchar(60) NOT NULL DEFAULT '',
	`entity_id` varchar(60) NOT NULL DEFAULT '',
	`meta_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`user_agent` varchar(255),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`mood` int NOT NULL,
	`energy` int NOT NULL,
	`anxiety` int NOT NULL,
	`body_notes` text,
	`request` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `check_ins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_profiles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`therapist_id` bigint unsigned NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`focus` varchar(255) NOT NULL DEFAULT '',
	`avatar_hue` int NOT NULL DEFAULT 320,
	`ai_consent` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_profiles_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `homework` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`session_id` bigint unsigned,
	`insight_title` varchar(255),
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`purpose` text,
	`frequency` varchar(120) NOT NULL DEFAULT '',
	`due_date` varchar(60) NOT NULL DEFAULT '',
	`status` enum('assigned','in_progress','done','skipped','cancelled') NOT NULL DEFAULT 'assigned',
	`approved` boolean NOT NULL DEFAULT false,
	`reflection` text,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `homework_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insights` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`client_action` enum('explore','practice','experiment','discuss','integrate') NOT NULL DEFAULT 'explore',
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`evidence_json` json,
	`approved` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`therapist_id` bigint unsigned NOT NULL,
	`focus` varchar(255) NOT NULL DEFAULT '',
	`used_by_user_id` bigint unsigned,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`current_focus` text,
	`goals_json` json,
	`stages_json` json,
	`resources_json` json,
	`obstacles_json` json,
	`next_steps_json` json,
	`experiments_json` json,
	`review_date` varchar(60) NOT NULL DEFAULT '',
	`version` int NOT NULL DEFAULT 1,
	`draft_pending` boolean NOT NULL DEFAULT false,
	`approved` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roadmaps_id` PRIMARY KEY(`id`),
	CONSTRAINT `roadmaps_client_id_unique` UNIQUE(`client_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`therapist_id` bigint unsigned NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`session_date` timestamp NOT NULL DEFAULT (now()),
	`duration_min` int NOT NULL DEFAULT 50,
	`status` enum('uploaded','queued','extracting_audio','transcribing','diarizing','analyzing','draft_ready','therapist_review','approved','sent_to_client','failed','requires_manual_fix') NOT NULL DEFAULT 'uploaded',
	`has_media` boolean NOT NULL DEFAULT false,
	`media_path` varchar(512),
	`media_size_bytes` bigint,
	`processing_error` text,
	`transcript_json` json,
	`summary_short` text,
	`client_friendly_summary` text,
	`emotions_json` json,
	`needs_json` json,
	`patterns_json` json,
	`risk_flags_json` json,
	`dynamics_json` json,
	`therapist_questions_json` json,
	`uncertainties_json` json,
	`model` varchar(120),
	`prompt_template_version` varchar(40),
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`approved_at` timestamp,
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`evidence_json` json,
	`approved` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `themes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `therapist_notes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`therapist_id` bigint unsigned NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`text` text NOT NULL,
	`tags_json` json,
	`use_as_ai_context` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `therapist_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `therapist_profiles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`bio` text,
	`max_active_clients` int NOT NULL DEFAULT 20,
	`monthly_session_limit` int NOT NULL DEFAULT 80,
	`monthly_hours_limit` float NOT NULL DEFAULT 120,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `therapist_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `therapist_profiles_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `token_usage` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`session_id` bigint unsigned,
	`kind` varchar(40) NOT NULL DEFAULT 'analysis',
	`model` varchar(120) NOT NULL,
	`prompt_template_version` varchar(40),
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`cost_estimate` float NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `token_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('therapist','client','admin') NOT NULL,
	`first_name` varchar(120) NOT NULL,
	`last_name` varchar(120) NOT NULL DEFAULT '',
	`timezone` varchar(64) NOT NULL DEFAULT 'Europe/Moscow',
	`locale` varchar(8) NOT NULL DEFAULT 'ru',
	`status` enum('active','blocked') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
