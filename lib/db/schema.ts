import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatarInitials: text("avatar_initials").notNull(),
  role: text("role").notNull(), // "admin" | "hr" | "interviewer" (deprecated — backfill source for user_roles)
  // Auth columns — NOT NULL enforced in migration 0003 after backfill
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  adminPassword: text("admin_password"),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  hasAccess: boolean("has_access").notNull().default(true),
  deactivationReason: text("deactivation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Vacancies ────────────────────────────────────────────────────────────────

export const vacancies = pgTable("vacancies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  workType: text("work_type").notNull(), // "office" | "remote" | "hybrid"
  employmentType: text("employment_type").notNull(), // "full-time" | "part-time" | "trial" | "internship"
  location: text("location").notNull(),
  salaryMin: integer("salary_min").notNull(),
  salaryMax: integer("salary_max").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(), // "active" | "paused" | "closed"
  language: text("language").notNull(), // "uz" | "en" | "ru"
  responsibleHrId: text("responsible_hr_id").references(() => users.id, { onDelete: "set null" }),
  stageIds: jsonb("stage_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull(),
  introMessage: text("intro_message"),
  successMessage: text("success_message"),
});

// ─── Vacancy Stages ───────────────────────────────────────────────────────────

export const vacancyStages = pgTable("vacancy_stages", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isFinal: boolean("is_final").notNull().default(false),
  isRejected: boolean("is_rejected").notNull().default(false),
  orderIndex: integer("order_index").notNull(),
});

// ─── Screening Questions ──────────────────────────────────────────────────────

export const screeningQuestions = pgTable("screening_questions", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  type: text("type").notNull(), // "short-text" | "long-text" | "phone" | "single-choice" | "yes-no" | "rating"
  options: jsonb("options").$type<string[]>(),
  orderIndex: integer("order_index").notNull(),
});

// ─── Candidates ───────────────────────────────────────────────────────────────

export const candidates = pgTable("candidates", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  telegramUsername: text("telegram_username").notNull(),
  telegramFirstName: text("telegram_first_name").notNull(),
  telegramUserId: text("telegram_user_id").unique(),
  language: text("language").notNull(), // "uz" | "en" | "ru"
  city: text("city").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

// ─── Applications ─────────────────────────────────────────────────────────────

export const applications = pgTable("applications", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  currentStageId: text("current_stage_id").notNull().references(() => vacancyStages.id),
  appliedAt: timestamp("applied_at").notNull(),
  lastActivityAt: timestamp("last_activity_at").notNull(),
  status: text("status").notNull().default("submitted"), // "in_progress" | "submitted" | "abandoned"
});

// ─── Screening Answers ────────────────────────────────────────────────────────

export const screeningAnswers = pgTable("screening_answers", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => screeningQuestions.id, { onDelete: "cascade" }),
  answerText: text("answer_text").notNull(),
  answeredAt: timestamp("answered_at").notNull(),
});

// ─── Timeline Events ──────────────────────────────────────────────────────────

export const timelineEvents = pgTable("timeline_events", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "application_started" | "application_completed" | "stage_changed" | "answer_submitted"
  description: text("description").notNull(),
  fromStageId: text("from_stage_id"),
  toStageId: text("to_stage_id"),
  createdAt: timestamp("created_at").notNull(),
});

// ─── Telegram Messages ────────────────────────────────────────────────────────

export const telegramMessages = pgTable("telegram_messages", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // "inbound" | "outbound"
  senderType: text("sender_type").notNull(), // "candidate" | "hr" | "system"
  senderName: text("sender_name"),
  text: text("text").notNull(),
  sentAt: timestamp("sent_at").notNull(),
  readByUserIds: jsonb("read_by_user_ids").$type<string[]>().default([]),
  attachmentFileId: text("attachment_file_id"),
  attachmentType: text("attachment_type"), // "photo" | "document" | null
  attachmentFilename: text("attachment_filename"),
});

// ─── Internal Notes ───────────────────────────────────────────────────────────

export const internalNotes = pgTable("internal_notes", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
});

// ─── Automation Rules ─────────────────────────────────────────────────────────

export const automationRules = pgTable("automation_rules", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  triggerType: text("trigger_type").notNull(), // "stage_entered" | "application_submitted"
  triggerStageId: text("trigger_stage_id"),
  actionType: text("action_type").notNull(), // "send_message" | "move_to_stage"
  actionStageId: text("action_stage_id"),
  actionMessageText: text("action_message_text"),
  createdAt: timestamp("created_at").notNull(),
});

// ─── Test Tasks ───────────────────────────────────────────────────────────────

export const testTasks = pgTable("test_tasks", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueInDays: integer("due_in_days").notNull(),
});

// ─── Test Task Assignments ────────────────────────────────────────────────────

export const testTaskAssignments = pgTable("test_task_assignments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => testTasks.id, { onDelete: "cascade" }),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull(),
  dueAt: timestamp("due_at").notNull(),
  status: text("status").notNull(), // "pending" | "submitted" | "passed" | "failed"
  submissionNote: text("submission_note"),
});

// ─── Sources ──────────────────────────────────────────────────────────────────

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  botLink: text("bot_link").notNull(),
});

// ─── Bot Sessions ─────────────────────────────────────────────────────────────

export const botSessions = pgTable("bot_sessions", {
  telegramUserId: text("telegram_user_id").primaryKey(),
  vacancyId: text("vacancy_id"),
  applicationId: text("application_id"),
  state: text("state").notNull(), // "awaiting_name" | "awaiting_question" | "complete"
  currentQuestionIndex: integer("current_question_index").default(0),
  collectedData: jsonb("collected_data").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── RBAC — Profiles ──────────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  telegramChatId: text("telegram_chat_id").unique(),
  telegramUsername: text("telegram_username"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── RBAC — Refresh Tokens ────────────────────────────────────────────────────

export const refreshTokens = pgTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(), // bcrypt-hashed
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── RBAC — User Roles ────────────────────────────────────────────────────────

export const userRoles = pgTable("user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  assignedBy: text("assigned_by"),
}, (t) => ({
  uniqUserRole: uniqueIndex("user_roles_user_role_uniq").on(t.userId, t.role),
}));

// ─── RBAC — System Roles ──────────────────────────────────────────────────────

export const systemRoles = pgTable("system_roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  color: text("color"),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── RBAC — Role Permissions ──────────────────────────────────────────────────

export const rolePermissions = pgTable("role_permissions", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  screenName: text("screen_name").notNull(),
  canRead: boolean("can_read").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  canWrite: boolean("can_write").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqRoleScreen: uniqueIndex("role_permissions_role_screen_uniq").on(t.role, t.screenName),
}));

// ─── RBAC — Audit Logs ────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  actorId: text("actor_id"),
  actorEmail: text("actor_email"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  entityName: text("entity_name"),
  description: text("description"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── RBAC — Login Attempts ────────────────────────────────────────────────────

export const loginAttempts = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull(),
  email: text("email"),
  success: boolean("success").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ipTimeIdx: index("login_attempts_ip_time_idx").on(t.ip, t.attemptedAt),
}));
