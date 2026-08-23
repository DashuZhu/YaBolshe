import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  json,
  float,
} from "drizzle-orm/mysql-core";

// ============================================================
// «Я Больше!» database schema (MySQL / Drizzle)
// ============================================================

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["therapist", "client", "admin", "owner"]).notNull(),
  isPlatformOwner: boolean("is_platform_owner").notNull().default(false),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull().default(""),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Europe/Moscow"),
  locale: varchar("locale", { length: 8 }).notNull().default("ru"),
  status: mysqlEnum("status", ["active", "blocked"]).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authSessions = mysqlTable("auth_sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  userAgent: varchar("user_agent", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const therapistProfiles = mysqlTable("therapist_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().unique(),
  bio: text("bio"),
  maxActiveClients: int("max_active_clients").notNull().default(20),
  monthlySessionLimit: int("monthly_session_limit").notNull().default(80),
  monthlyHoursLimit: float("monthly_hours_limit").notNull().default(120),
  plan: mysqlEnum("plan", ["free", "pro"]).notNull().default("free"),
  subscriptionStatus: mysqlEnum("subscription_status", [
    "active",
    "trialing",
    "past_due",
    "cancelled",
  ])
    .notNull()
    .default("active"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invitations for platform-level accounts. Today owner/admin issue free
// invitations manually; later payment can create the same invitation with a
// paid plan without changing the registration flow.
export const accountInvites = mysqlTable("account_invites", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["therapist", "admin", "owner"]).notNull().default("therapist"),
  isPlatformOwner: boolean("is_platform_owner").notNull().default(false),
  plan: mysqlEnum("plan", ["free", "pro"]).notNull().default("free"),
  invitedByUserId: bigint("invited_by_user_id", { mode: "number", unsigned: true }).notNull(),
  usedByUserId: bigint("used_by_user_id", { mode: "number", unsigned: true }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const clientProfiles = mysqlTable("client_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().unique(),
  therapistId: bigint("therapist_id", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["active", "archived"]).notNull().default("active"),
  focus: varchar("focus", { length: 255 }).notNull().default(""),
  avatarHue: int("avatar_hue").notNull().default(320),
  aiConsent: boolean("ai_consent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invites = mysqlTable("invites", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  therapistId: bigint("therapist_id", { mode: "number", unsigned: true }).notNull(),
  email: varchar("email", { length: 320 }),
  focus: varchar("focus", { length: 255 }).notNull().default(""),
  usedByUserId: bigint("used_by_user_id", { mode: "number", unsigned: true }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = mysqlTable("sessions", {
  id: serial("id").primaryKey(),
  therapistId: bigint("therapist_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(), // client_profiles.id
  title: varchar("title", { length: 255 }).notNull(),
  sessionDate: timestamp("session_date").notNull().defaultNow(),
  durationMin: int("duration_min").notNull().default(50),
  status: mysqlEnum("status", [
    "uploaded",
    "queued",
    "extracting_audio",
    "transcribing",
    "diarizing",
    "analyzing",
    "draft_ready",
    "therapist_review",
    "approved",
    "sent_to_client",
    "failed",
    "requires_manual_fix",
  ])
    .notNull()
    .default("uploaded"),
  hasMedia: boolean("has_media").notNull().default(false),
  mediaPath: varchar("media_path", { length: 512 }),
  mediaSizeBytes: bigint("media_size_bytes", { mode: "number" }),
  processingError: text("processing_error"),
  // transcript: array of segments [{id,start,end,speaker,text,confidence}]
  transcriptJson: json("transcript_json"),
  // AI analysis fields
  summaryShort: text("summary_short"),
  clientFriendlySummary: text("client_friendly_summary"),
  emotionsJson: json("emotions_json"),
  needsJson: json("needs_json"),
  patternsJson: json("patterns_json"),
  riskFlagsJson: json("risk_flags_json"),
  dynamicsJson: json("dynamics_json"),
  therapistQuestionsJson: json("therapist_questions_json"),
  uncertaintiesJson: json("uncertainties_json"),
  model: varchar("model", { length: 120 }),
  promptTemplateVersion: varchar("prompt_template_version", { length: 40 }),
  inputTokens: int("input_tokens").notNull().default(0),
  outputTokens: int("output_tokens").notNull().default(0),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insights = mysqlTable("insights", {
  id: serial("id").primaryKey(),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  clientAction: mysqlEnum("client_action", [
    "explore",
    "practice",
    "experiment",
    "discuss",
    "integrate",
  ])
    .notNull()
    .default("explore"),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).notNull().default("medium"),
  evidenceJson: json("evidence_json"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const themes = mysqlTable("themes", {
  id: serial("id").primaryKey(),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).notNull().default("medium"),
  evidenceJson: json("evidence_json"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const homework = mysqlTable("homework", {
  id: serial("id").primaryKey(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }),
  insightTitle: varchar("insight_title", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  purpose: text("purpose"),
  frequency: varchar("frequency", { length: 120 }).notNull().default(""),
  dueDate: varchar("due_date", { length: 60 }).notNull().default(""),
  status: mysqlEnum("status", ["assigned", "in_progress", "done", "skipped", "cancelled"])
    .notNull()
    .default("assigned"),
  approved: boolean("approved").notNull().default(false),
  reflection: text("reflection"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agreements = mysqlTable("agreements", {
  id: serial("id").primaryKey(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }),
  text: text("text").notNull(),
  type: mysqlEnum("type", ["installation", "agreement", "rule", "intention", "experiment"])
    .notNull()
    .default("agreement"),
  status: mysqlEnum("status", ["active", "review", "completed"]).notNull().default("active"),
  reviewDate: varchar("review_date", { length: 60 }).notNull().default(""),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roadmaps = mysqlTable("roadmaps", {
  id: serial("id").primaryKey(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull().unique(),
  currentFocus: text("current_focus"),
  goalsJson: json("goals_json"),
  stagesJson: json("stages_json"),
  resourcesJson: json("resources_json"),
  obstaclesJson: json("obstacles_json"),
  nextStepsJson: json("next_steps_json"),
  experimentsJson: json("experiments_json"),
  reviewDate: varchar("review_date", { length: 60 }).notNull().default(""),
  version: int("version").notNull().default(1),
  draftPending: boolean("draft_pending").notNull().default(false),
  approved: boolean("approved").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const therapistNotes = mysqlTable("therapist_notes", {
  id: serial("id").primaryKey(),
  therapistId: bigint("therapist_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  text: text("text").notNull(),
  tagsJson: json("tags_json"),
  useAsAiContext: boolean("use_as_ai_context").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checkIns = mysqlTable("check_ins", {
  id: serial("id").primaryKey(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  mood: int("mood").notNull(),
  energy: int("energy").notNull(),
  anxiety: int("anxiety").notNull(),
  bodyNotes: text("body_notes"),
  request: text("request"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: bigint("actor_id", { mode: "number", unsigned: true }),
  actorName: varchar("actor_name", { length: 200 }).notNull().default("system"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 60 }).notNull().default(""),
  entityId: varchar("entity_id", { length: 60 }).notNull().default(""),
  metaJson: json("meta_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tokenUsage = mysqlTable("token_usage", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }),
  kind: varchar("kind", { length: 40 }).notNull().default("analysis"), // analysis | transcription
  model: varchar("model", { length: 120 }).notNull(),
  promptTemplateVersion: varchar("prompt_template_version", { length: 40 }),
  inputTokens: int("input_tokens").notNull().default(0),
  outputTokens: int("output_tokens").notNull().default(0),
  costEstimate: float("cost_estimate").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- inferred types ----
export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type TherapistProfile = typeof therapistProfiles.$inferSelect;
export type AccountInvite = typeof accountInvites.$inferSelect;
export type ClientProfile = typeof clientProfiles.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type InsightRow = typeof insights.$inferSelect;
export type ThemeRow = typeof themes.$inferSelect;
export type HomeworkRow = typeof homework.$inferSelect;
export type AgreementRow = typeof agreements.$inferSelect;
export type RoadmapRow = typeof roadmaps.$inferSelect;
export type TherapistNoteRow = typeof therapistNotes.$inferSelect;
export type CheckInRow = typeof checkIns.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type TokenUsageRow = typeof tokenUsage.$inferSelect;
