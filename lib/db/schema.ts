import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
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
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  hasAccess: boolean("has_access").notNull().default(true),
  deactivationReason: text("deactivation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  telegramUserId: text("telegram_user_id").unique(),
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
  lastActivatedAt: timestamp("last_activated_at", { withTimezone: true }).notNull().defaultNow(),
  introMessage: text("intro_message"),
  successMessage: text("success_message"),
  isDemo: boolean("is_demo").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: text("deleted_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  deletedAtIdx: index("vacancies_deleted_at_idx").on(t.deletedAt),
}));

export const vacancyStatusChanges = pgTable("vacancy_status_changes", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").references(() => users.id, { onDelete: "set null" }),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vacancyChangedAtIdx: index("vacancy_status_changes_vacancy_changed_at_idx").on(t.vacancyId, t.changedAt),
}));

// ─── Vacancy Stages ───────────────────────────────────────────────────────────

export const vacancyStages = pgTable("vacancy_stages", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isFinal: boolean("is_final").notNull().default(false),
  isRejected: boolean("is_rejected").notNull().default(false),
  isReserve: boolean("is_reserve").notNull().default(false),
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

// ─── Departments ─────────────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Candidates ───────────────────────────────────────────────────────────────

export type WorkExperienceEntry = {
  company?: string;
  position?: string;
  period?: string;
  leaveReason?: string;
};

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
  isDemo: boolean("is_demo").notNull().default(false),
  dateOfBirth: date("date_of_birth", { mode: "date" }),
  address: text("address"),
  maritalStatus: text("marital_status"), // "single" | "married" | "divorced" | "other"
  isStudent: boolean("is_student"),
  educationField: text("education_field"),
  englishLevel: text("english_level"), // "none" | "a1_a2" | "b1_b2" | "c1_c2" | "native"
  russianLevel: text("russian_level"),
  workExperience: jsonb("work_experience").$type<WorkExperienceEntry[]>(),
  departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  isBlacklisted: boolean("is_blacklisted").notNull().default(false),
  languagePref: text("language_pref"), // "ru" | "uz" | "en"
  photoFileId: text("photo_file_id"),
  photoUrl: text("photo_url"),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  consentVersion: text("consent_version"),
  educationInstitution: text("education_institution"),
  studyForm: text("study_form"),
  studyYear: text("study_year"),
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
  sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
  motivationLetter: text("motivation_letter"),
  portfolioLinks: jsonb("portfolio_links").$type<string[]>(),
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
  comment: text("comment"),
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

// ─── Automation Runs ──────────────────────────────────────────────────────────

export const automationRuns = pgTable("automation_runs", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id").references(() => automationRules.id, { onDelete: "set null" }),
  vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }),
  candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
  ruleName: text("rule_name").notNull(),
  vacancyTitle: text("vacancy_title").notNull(),
  candidateName: text("candidate_name"),
  triggerType: text("trigger_type").notNull(),
  triggerStageId: text("trigger_stage_id"),
  actionType: text("action_type").notNull(),
  status: text("status").notNull(), // "success" | "skipped" | "failed"
  messageText: text("message_text"),
  error: text("error"),
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
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Bot Sessions ─────────────────────────────────────────────────────────────

export const botSessions = pgTable("bot_sessions", {
  telegramUserId: text("telegram_user_id").primaryKey(),
  vacancyId: text("vacancy_id"),
  applicationId: text("application_id"),
  state: text("state").notNull(), // see ANKETA_STATES in lib/bot/handlers.ts for the full list
  currentQuestionIndex: integer("current_question_index").default(0),
  collectedData: jsonb("collected_data").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Question Templates ───────────────────────────────────────────────────────

export const questionTemplates = pgTable("question_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionTemplateItems = pgTable("question_template_items", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => questionTemplates.id, { onDelete: "cascade" }),
  text: jsonb("text").$type<{ uz: string; ru: string; en: string } | string>().notNull(),
  type: text("type").notNull(), // "short-text" | "long-text" | "phone" | "single-choice" | "yes-no" | "rating"
  options: jsonb("options").$type<string[]>(),
  orderIndex: integer("order_index").notNull(),
});

// ─── Message Templates ───────────────────────────────────────────────────────

export const messageTemplates = pgTable("message_templates", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // "intro" | "success" | future message surfaces
  language: text("language").notNull().default("uz"), // "uz" | "en" | "ru"
  name: text("name").notNull(),
  content: text("content").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  isGlobal: boolean("is_global").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  kindIdx: index("message_templates_kind_idx").on(t.kind),
  languageIdx: index("message_templates_language_idx").on(t.language),
  ownerIdx: index("message_templates_owner_idx").on(t.ownerId),
}));

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
  vacancyId: text("vacancy_id").references(() => vacancies.id, { onDelete: "set null" }),
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

// ─── Stage Templates ──────────────────────────────────────────────────────────

export const stageTemplates = pgTable("stage_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stageTemplateStages = pgTable("stage_template_stages", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => stageTemplates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isFinal: boolean("is_final").notNull().default(false),
  isRejected: boolean("is_rejected").notNull().default(false),
  isReserve: boolean("is_reserve").notNull().default(false),
  orderIndex: integer("order_index").notNull(),
});

// ─── HR Flow V2 ───────────────────────────────────────────────────────────────

export const applicationWatches = pgTable("application_watches", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  watcherId: text("watcher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqApplicationWatcher: uniqueIndex("application_watches_application_watcher_uniq").on(t.applicationId, t.watcherId),
  applicationIdx: index("application_watches_application_idx").on(t.applicationId),
  watcherIdx: index("application_watches_watcher_idx").on(t.watcherId),
}));

export const candidateRelationships = pgTable("candidate_relationships", {
  id: text("id").primaryKey(),
  candidateAId: text("candidate_a_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  candidateBId: text("candidate_b_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "referral" | "family" | "alumni" | "other"
  note: text("note"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  candidateAIdx: index("candidate_relationships_candidate_a_idx").on(t.candidateAId),
  candidateBIdx: index("candidate_relationships_candidate_b_idx").on(t.candidateBId),
}));

export const candidateBlacklist = pgTable("candidate_blacklist", {
  candidateId: text("candidate_id").primaryKey().references(() => candidates.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  addedBy: text("added_by").references(() => users.id, { onDelete: "set null" }),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  source: text("source").notNull(), // "candidate" | "hr"
  kind: text("kind").notNull().default("general"), // "general" | "complaint" | "suggestion"
  status: text("status").notNull().default("new"), // "new" | "in_review" | "responded" | "resolved"
  candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }),
  vacancyId: text("vacancy_id").references(() => vacancies.id, { onDelete: "set null" }),
  rating: integer("rating"),
  comment: text("comment"),
  replyText: text("reply_text"),
  replyLink: text("reply_link"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("feedback_candidate_idx").on(t.candidateId),
  applicationIdx: index("feedback_application_idx").on(t.applicationId),
  vacancyIdx: index("feedback_vacancy_idx").on(t.vacancyId),
  statusIdx: index("feedback_status_idx").on(t.status),
}));

// ─── Candidate Filter Views ───────────────────────────────────────────────────

export const candidateFilterViews = pgTable("candidate_filter_views", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Backup Runs ──────────────────────────────────────────────────────────────

export const backupRuns = pgTable("backup_runs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),          // "csv" | "pg_dump"
  status: text("status").notNull(),       // "success" | "failed"
  rowCount: integer("row_count"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

// ─── Vacancy Deletion Backups ────────────────────────────────────────────────

export const vacancyDeletionBackups = pgTable("vacancy_deletion_backups", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").notNull(),
  vacancyTitle: text("vacancy_title").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
  deletedBy: text("deleted_by").references(() => users.id, { onDelete: "set null" }),
  hardDeletedAt: timestamp("hard_deleted_at", { withTimezone: true }),
  restoreExpiresAt: timestamp("restore_expires_at", { withTimezone: true }).notNull(),
}, (t) => ({
  vacancyIdx: index("vacancy_deletion_backups_vacancy_idx").on(t.vacancyId),
  deletedAtIdx: index("vacancy_deletion_backups_deleted_at_idx").on(t.deletedAt),
}));

// ─── Bot Content ──────────────────────────────────────────────────────────────

export const botContent = pgTable("bot_content", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),         // e.g. "about_us" | "contact_us"
  language: text("language").notNull(), // "uz" | "ru" | "en"
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  keyLangIdx: uniqueIndex("bot_content_key_lang_idx").on(t.key, t.language),
}));

// ─── Bot Translations ─────────────────────────────────────────────────────────

export const botTranslations = pgTable("bot_translations", {
  key: text("key").notNull(),
  language: text("language").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.key, t.language] }),
  keyIdx: index("bot_translations_key_idx").on(t.key),
}));

// ─── Bot Test Users ──────────────────────────────────────────────────────────

export const botTestUsers = pgTable("bot_test_users", {
  id: text("id").primaryKey(),
  telegramUserId: text("telegram_user_id"),
  telegramUsername: text("telegram_username"),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  addedBy: text("added_by").references(() => users.id, { onDelete: "set null" }),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
