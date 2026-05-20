import type {
  User, Vacancy, VacancyStage, Candidate, Application,
  ScreeningQuestion, ScreeningAnswer, TimelineEvent,
  Source, QuestionTemplate, AutomationRule, TestTask, TestTaskAssignment,
} from "./types";

// ─── Users ──────────────────────────────────────────────────────────────────

export const USERS: User[] = [
  { id: "u1", name: "Aziza Karimova", avatarInitials: "AK", role: "hr" },
  { id: "u2", name: "Bobur Toshmatov", avatarInitials: "BT", role: "hr" },
  { id: "u3", name: "Dilnoza Yusupova", avatarInitials: "DY", role: "admin" },
];

// ─── Vacancies ───────────────────────────────────────────────────────────────

export const VACANCIES: Vacancy[] = [
  {
    id: "v1",
    title: "Vibecoder / AI-Powered Frontend Dev",
    department: "Engineering",
    workType: "remote",
    employmentType: "full-time",
    location: "Tashkent / Remote",
    salaryMin: 2000,
    salaryMax: 4000,
    description:
      "We're looking for a frontend engineer who can rapidly prototype with AI tools (Claude Code, Cursor, Lovable). You'll work directly with founders, ship fast, and shape the product.",
    status: "active",
    language: "en",
    responsibleHrId: "u1",
    stageIds: ["s1_1", "s1_2", "s1_3", "s1_4", "s1_5", "s1_6", "s1_7", "s1_8"],
    createdAt: "2025-04-10T09:00:00Z",
  },
  {
    id: "v2",
    title: "Sales Manager (B2B SaaS)",
    department: "Sales",
    workType: "office",
    employmentType: "full-time",
    location: "Tashkent",
    salaryMin: 1200,
    salaryMax: 2500,
    description:
      "Sotuv bo'yicha tajribali mutaxassis izlayapmiz. B2B SaaS mahsulotimizni korporativ mijozlarga sotish, demo o'tkazish va shartnomalarni yopish.",
    status: "active",
    language: "uz",
    responsibleHrId: "u2",
    stageIds: ["s2_1", "s2_2", "s2_3", "s2_4", "s2_5", "s2_6"],
    createdAt: "2025-04-15T10:00:00Z",
  },
  {
    id: "v3",
    title: "Junior UI/UX Designer",
    department: "Design",
    workType: "hybrid",
    employmentType: "trial",
    location: "Tashkent",
    salaryMin: 800,
    salaryMax: 1500,
    description:
      "Design team is growing. We need a junior designer who is comfortable with Figma, knows the basics of user research, and is eager to learn product thinking.",
    status: "active",
    language: "en",
    responsibleHrId: "u1",
    stageIds: ["s3_1", "s3_2", "s3_3", "s3_4", "s3_5"],
    createdAt: "2025-04-20T08:00:00Z",
  },
];

// ─── Stages ───────────────────────────────────────────────────────────────────

export const STAGES: VacancyStage[] = [
  // Vibecoder stages
  { id: "s1_1", vacancyId: "v1", name: "New",            color: "new",        isFinal: false, isRejected: false, orderIndex: 0 },
  { id: "s1_2", vacancyId: "v1", name: "Screening",      color: "screening",  isFinal: false, isRejected: false, orderIndex: 1 },
  { id: "s1_3", vacancyId: "v1", name: "Qualified",      color: "qualified",  isFinal: false, isRejected: false, orderIndex: 2 },
  { id: "s1_4", vacancyId: "v1", name: "Test Sent",      color: "test",       isFinal: false, isRejected: false, orderIndex: 3 },
  { id: "s1_5", vacancyId: "v1", name: "Test Submitted", color: "test",       isFinal: false, isRejected: false, orderIndex: 4 },
  { id: "s1_6", vacancyId: "v1", name: "Interview",      color: "interview",  isFinal: false, isRejected: false, orderIndex: 5 },
  { id: "s1_7", vacancyId: "v1", name: "Hired",          color: "hired",      isFinal: true,  isRejected: false, orderIndex: 6 },
  { id: "s1_8", vacancyId: "v1", name: "Rejected",       color: "rejected",   isFinal: true,  isRejected: true,  orderIndex: 7 },

  // Sales Manager stages
  { id: "s2_1", vacancyId: "v2", name: "New",       color: "new",       isFinal: false, isRejected: false, orderIndex: 0 },
  { id: "s2_2", vacancyId: "v2", name: "Screening", color: "screening", isFinal: false, isRejected: false, orderIndex: 1 },
  { id: "s2_3", vacancyId: "v2", name: "Test Sent", color: "test",      isFinal: false, isRejected: false, orderIndex: 2 },
  { id: "s2_4", vacancyId: "v2", name: "Interview", color: "interview", isFinal: false, isRejected: false, orderIndex: 3 },
  { id: "s2_5", vacancyId: "v2", name: "Hired",     color: "hired",     isFinal: true,  isRejected: false, orderIndex: 4 },
  { id: "s2_6", vacancyId: "v2", name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true,  orderIndex: 5 },

  // Designer stages
  { id: "s3_1", vacancyId: "v3", name: "New",       color: "new",       isFinal: false, isRejected: false, orderIndex: 0 },
  { id: "s3_2", vacancyId: "v3", name: "Screening", color: "screening", isFinal: false, isRejected: false, orderIndex: 1 },
  { id: "s3_3", vacancyId: "v3", name: "Interview", color: "interview", isFinal: false, isRejected: false, orderIndex: 2 },
  { id: "s3_4", vacancyId: "v3", name: "Hired",     color: "hired",     isFinal: true,  isRejected: false, orderIndex: 3 },
  { id: "s3_5", vacancyId: "v3", name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true,  orderIndex: 4 },
];

// ─── Candidates ───────────────────────────────────────────────────────────────

export const CANDIDATES: Candidate[] = [
  { id: "c1",  fullName: "Sardor Yusupov",      phone: "+998 90 123 4567", telegramUsername: "sardor_dev",      telegramFirstName: "Sardor",   language: "uz", city: "Tashkent",  createdAt: "2025-04-12T10:30:00Z" },
  { id: "c2",  fullName: "Jasur Mirzayev",       phone: "+998 91 234 5678", telegramUsername: "jasur_codes",     telegramFirstName: "Jasur",    language: "uz", city: "Tashkent",  createdAt: "2025-04-13T09:15:00Z" },
  { id: "c3",  fullName: "Kamola Rakhimova",     phone: "+998 93 345 6789", telegramUsername: "kamola_ux",       telegramFirstName: "Kamola",   language: "uz", city: "Samarkand", createdAt: "2025-04-14T11:00:00Z" },
  { id: "c4",  fullName: "Otabek Normatov",      phone: "+998 94 456 7890", telegramUsername: "otabek_fn",       telegramFirstName: "Otabek",   language: "uz", city: "Tashkent",  createdAt: "2025-04-15T14:20:00Z" },
  { id: "c5",  fullName: "Nilufar Hasanova",     phone: "+998 90 567 8901", telegramUsername: "nilufar_h",       telegramFirstName: "Nilufar",  language: "uz", city: "Tashkent",  createdAt: "2025-04-16T08:45:00Z" },
  { id: "c6",  fullName: "Bobur Tursunov",       phone: "+998 99 678 9012", telegramUsername: "bobur_t",         telegramFirstName: "Bobur",    language: "uz", city: "Fergana",   createdAt: "2025-04-17T16:30:00Z" },
  { id: "c7",  fullName: "Zulfiya Abdullayeva",  phone: "+998 91 789 0123", telegramUsername: "zulfiya_a",       telegramFirstName: "Zulfiya",  language: "uz", city: "Tashkent",  createdAt: "2025-04-18T10:00:00Z" },
  { id: "c8",  fullName: "Sherzod Qodirov",      phone: "+998 93 890 1234", telegramUsername: "sherzod_q",       telegramFirstName: "Sherzod",  language: "uz", city: "Namangan",  createdAt: "2025-04-19T13:15:00Z" },
  { id: "c9",  fullName: "Malika Ergasheva",     phone: "+998 94 901 2345", telegramUsername: "malika_e",        telegramFirstName: "Malika",   language: "uz", city: "Tashkent",  createdAt: "2025-04-20T09:30:00Z" },
  { id: "c10", fullName: "Ulugbek Nazarov",      phone: "+998 90 012 3456", telegramUsername: "ulugbek_n",       telegramFirstName: "Ulugbek",  language: "uz", city: "Tashkent",  createdAt: "2025-04-21T11:45:00Z" },
  { id: "c11", fullName: "Feruza Saidova",       phone: "+998 91 123 4568", telegramUsername: "feruza_s",        telegramFirstName: "Feruza",   language: "uz", city: "Bukhara",   createdAt: "2025-04-22T15:00:00Z" },
  { id: "c12", fullName: "Doniyor Kholmatov",    phone: "+998 99 234 5679", telegramUsername: "doniyor_k",       telegramFirstName: "Doniyor",  language: "uz", city: "Tashkent",  createdAt: "2025-04-23T08:20:00Z" },
  { id: "c13", fullName: "Ozoda Toshpulatova",   phone: "+998 93 345 6780", telegramUsername: "ozoda_t",         telegramFirstName: "Ozoda",    language: "uz", city: "Tashkent",  createdAt: "2025-04-24T10:10:00Z" },
  { id: "c14", fullName: "Mansur Jalolov",       phone: "+998 94 456 7891", telegramUsername: "mansur_j",        telegramFirstName: "Mansur",   language: "uz", city: "Andijan",   createdAt: "2025-04-25T12:00:00Z" },
  { id: "c15", fullName: "Gulnora Mirzaeva",     phone: "+998 90 567 8902", telegramUsername: "gulnora_m",       telegramFirstName: "Gulnora",  language: "uz", city: "Tashkent",  createdAt: "2025-04-26T14:30:00Z" },
  { id: "c16", fullName: "Akbar Umarov",         phone: "+998 91 678 9013", telegramUsername: "akbar_u",         telegramFirstName: "Akbar",    language: "uz", city: "Tashkent",  createdAt: "2025-04-27T09:00:00Z" },
  { id: "c17", fullName: "Shahlo Usmonova",      phone: "+998 99 789 0124", telegramUsername: "shahlo_u",        telegramFirstName: "Shahlo",   language: "uz", city: "Tashkent",  createdAt: "2025-04-28T11:20:00Z" },
  { id: "c18", fullName: "Behruz Xoliqov",       phone: "+998 93 890 1235", telegramUsername: "behruz_x",        telegramFirstName: "Behruz",   language: "uz", city: "Samarkand", createdAt: "2025-04-29T13:45:00Z" },
  { id: "c19", fullName: "Nargiza Qosimova",     phone: "+998 94 901 2346", telegramUsername: "nargiza_q",       telegramFirstName: "Nargiza",  language: "uz", city: "Tashkent",  createdAt: "2025-04-30T08:30:00Z" },
  { id: "c20", fullName: "Timur Rустамов",       phone: "+998 90 012 3457", telegramUsername: "timur_rust",      telegramFirstName: "Timur",    language: "ru", city: "Tashkent",  createdAt: "2025-05-01T10:00:00Z" },
];

// ─── Applications ─────────────────────────────────────────────────────────────
// Vibecoder: 12 applications spread across 8 stages
// Sales: 5 applications
// Designer: 3 applications

export const APPLICATIONS: Application[] = [
  // ── Vibecoder (v1) ──────────────────────────────────────────────────────────
  { id: "a1",  candidateId: "c1",  vacancyId: "v1", currentStageId: "s1_6", appliedAt: "2025-04-12T10:35:00Z", lastActivityAt: "2025-04-28T09:00:00Z", status: "submitted" }, // Interview
  { id: "a2",  candidateId: "c2",  vacancyId: "v1", currentStageId: "s1_5", appliedAt: "2025-04-13T09:20:00Z", lastActivityAt: "2025-04-27T14:00:00Z", status: "submitted" }, // Test Submitted
  { id: "a3",  candidateId: "c3",  vacancyId: "v1", currentStageId: "s1_2", appliedAt: "2025-04-14T11:05:00Z", lastActivityAt: "2025-04-29T10:00:00Z", status: "submitted" }, // Screening
  { id: "a4",  candidateId: "c4",  vacancyId: "v1", currentStageId: "s1_4", appliedAt: "2025-04-15T14:25:00Z", lastActivityAt: "2025-04-26T16:00:00Z", status: "submitted" }, // Test Sent
  { id: "a5",  candidateId: "c5",  vacancyId: "v1", currentStageId: "s1_1", appliedAt: "2025-04-30T08:50:00Z", lastActivityAt: "2025-04-30T08:50:00Z", status: "submitted" }, // New
  { id: "a6",  candidateId: "c6",  vacancyId: "v1", currentStageId: "s1_1", appliedAt: "2025-05-01T09:10:00Z", lastActivityAt: "2025-05-01T09:10:00Z", status: "submitted" }, // New
  { id: "a7",  candidateId: "c7",  vacancyId: "v1", currentStageId: "s1_3", appliedAt: "2025-04-18T10:05:00Z", lastActivityAt: "2025-04-25T11:00:00Z", status: "submitted" }, // Qualified
  { id: "a8",  candidateId: "c8",  vacancyId: "v1", currentStageId: "s1_2", appliedAt: "2025-04-19T13:20:00Z", lastActivityAt: "2025-04-30T09:00:00Z", status: "submitted" }, // Screening
  { id: "a9",  candidateId: "c9",  vacancyId: "v1", currentStageId: "s1_8", appliedAt: "2025-04-20T09:35:00Z", lastActivityAt: "2025-04-24T15:00:00Z", status: "submitted" }, // Rejected
  { id: "a10", candidateId: "c10", vacancyId: "v1", currentStageId: "s1_7", appliedAt: "2025-04-21T11:50:00Z", lastActivityAt: "2025-05-02T10:00:00Z", status: "submitted" }, // Hired
  { id: "a11", candidateId: "c11", vacancyId: "v1", currentStageId: "s1_1", appliedAt: "2025-05-02T15:05:00Z", lastActivityAt: "2025-05-02T15:05:00Z", status: "submitted" }, // New
  { id: "a12", candidateId: "c12", vacancyId: "v1", currentStageId: "s1_6", appliedAt: "2025-04-23T08:25:00Z", lastActivityAt: "2025-05-01T14:00:00Z", status: "submitted" }, // Interview

  // ── Sales Manager (v2) ──────────────────────────────────────────────────────
  { id: "a13", candidateId: "c13", vacancyId: "v2", currentStageId: "s2_1", appliedAt: "2025-04-24T10:15:00Z", lastActivityAt: "2025-04-24T10:15:00Z", status: "submitted" }, // New
  { id: "a14", candidateId: "c14", vacancyId: "v2", currentStageId: "s2_2", appliedAt: "2025-04-25T12:05:00Z", lastActivityAt: "2025-04-29T11:00:00Z", status: "submitted" }, // Screening
  { id: "a15", candidateId: "c15", vacancyId: "v2", currentStageId: "s2_3", appliedAt: "2025-04-26T14:35:00Z", lastActivityAt: "2025-04-30T13:00:00Z", status: "submitted" }, // Test Sent
  { id: "a16", candidateId: "c16", vacancyId: "v2", currentStageId: "s2_4", appliedAt: "2025-04-27T09:05:00Z", lastActivityAt: "2025-05-01T10:00:00Z", status: "submitted" }, // Interview
  { id: "a17", candidateId: "c17", vacancyId: "v2", currentStageId: "s2_6", appliedAt: "2025-04-28T11:25:00Z", lastActivityAt: "2025-04-30T16:00:00Z", status: "submitted" }, // Rejected

  // ── Designer (v3) ───────────────────────────────────────────────────────────
  { id: "a18", candidateId: "c18", vacancyId: "v3", currentStageId: "s3_1", appliedAt: "2025-04-29T13:50:00Z", lastActivityAt: "2025-04-29T13:50:00Z", status: "submitted" }, // New
  { id: "a19", candidateId: "c19", vacancyId: "v3", currentStageId: "s3_2", appliedAt: "2025-04-30T08:35:00Z", lastActivityAt: "2025-05-01T09:00:00Z", status: "submitted" }, // Screening
  { id: "a20", candidateId: "c20", vacancyId: "v3", currentStageId: "s3_3", appliedAt: "2025-05-01T10:05:00Z", lastActivityAt: "2025-05-02T11:00:00Z", status: "submitted" }, // Interview
];

// ─── Screening Questions ──────────────────────────────────────────────────────

export const QUESTIONS: ScreeningQuestion[] = [
  // Vibecoder questions
  { id: "q1_1", vacancyId: "v1", text: "What's your experience with AI coding tools (Claude Code, Cursor, Copilot, etc.)?", type: "long-text", orderIndex: 0 },
  { id: "q1_2", vacancyId: "v1", text: "Share a link to your best frontend project (GitHub / live URL).", type: "short-text", orderIndex: 1 },
  { id: "q1_3", vacancyId: "v1", text: "How quickly can you build a basic CRUD UI from scratch? (be honest)", type: "single-choice", options: ["< 1 hour", "1–3 hours", "3–6 hours", "Full day"], orderIndex: 2 },
  { id: "q1_4", vacancyId: "v1", text: "Are you comfortable working directly with founders without detailed specs?", type: "yes-no", orderIndex: 3 },
  { id: "q1_5", vacancyId: "v1", text: "What's your expected monthly salary in USD?", type: "short-text", orderIndex: 4 },

  // Sales questions
  { id: "q2_1", vacancyId: "v2", text: "Sotuv sohasidagi tajribangizni tasvirlab bering (yillar, sohalar).", type: "long-text", orderIndex: 0 },
  { id: "q2_2", vacancyId: "v2", text: "Oyiga nechtadan shart-shartnoma yopa olasiz (taxminiy)?", type: "single-choice", options: ["1–3 ta", "4–7 ta", "8–12 ta", "12+ ta"], orderIndex: 1 },
  { id: "q2_3", vacancyId: "v2", text: "CRM tizimlaridan foydalanganmisiz?", type: "yes-no", orderIndex: 2 },
  { id: "q2_4", vacancyId: "v2", text: "Kutilayotgan oylik maosh (UZS).", type: "short-text", orderIndex: 3 },

  // Designer questions
  { id: "q3_1", vacancyId: "v3", text: "Share your Figma portfolio or Behance link.", type: "short-text", orderIndex: 0 },
  { id: "q3_2", vacancyId: "v3", text: "How many years have you been using Figma?", type: "single-choice", options: ["< 1 year", "1–2 years", "2–4 years", "4+ years"], orderIndex: 1 },
  { id: "q3_3", vacancyId: "v3", text: "Describe a design decision you made that improved a product metric.", type: "long-text", orderIndex: 2 },
];

// ─── Screening Answers ────────────────────────────────────────────────────────

export const ANSWERS: ScreeningAnswer[] = [
  // a1 — Sardor (Interview stage, Vibecoder)
  { id: "an1_1", applicationId: "a1", questionId: "q1_1", answerText: "I've been using Cursor daily for 8 months and recently switched to Claude Code for complex refactors. I've built 3 production apps with AI assistance — it cuts my time by 60%.", answeredAt: "2025-04-12T10:50:00Z" },
  { id: "an1_2", applicationId: "a1", questionId: "q1_2", answerText: "github.com/sardor-dev/relay-clone — a full Relay-style task manager built in 2 days with Claude Code.", answeredAt: "2025-04-12T10:52:00Z" },
  { id: "an1_3", applicationId: "a1", questionId: "q1_3", answerText: "1–3 hours", answeredAt: "2025-04-12T10:53:00Z" },
  { id: "an1_4", applicationId: "a1", questionId: "q1_4", answerText: "Yes — I actually prefer it. Less bureaucracy, faster feedback loop.", answeredAt: "2025-04-12T10:54:00Z" },
  { id: "an1_5", applicationId: "a1", questionId: "q1_5", answerText: "$3,000 – $3,500", answeredAt: "2025-04-12T10:55:00Z" },

  // a2 — Jasur (Test Submitted, Vibecoder)
  { id: "an2_1", applicationId: "a2", questionId: "q1_1", answerText: "Mostly Copilot in VS Code for 1.5 years. Recently started Cursor. Haven't tried Claude Code yet but curious.", answeredAt: "2025-04-13T09:30:00Z" },
  { id: "an2_2", applicationId: "a2", questionId: "q1_2", answerText: "github.com/jasurm/ecommerce-next — Next.js e-commerce with Stripe.", answeredAt: "2025-04-13T09:32:00Z" },
  { id: "an2_3", applicationId: "a2", questionId: "q1_3", answerText: "3–6 hours", answeredAt: "2025-04-13T09:33:00Z" },
  { id: "an2_4", applicationId: "a2", questionId: "q1_4", answerText: "Yes, I'm used to startups.", answeredAt: "2025-04-13T09:34:00Z" },
  { id: "an2_5", applicationId: "a2", questionId: "q1_5", answerText: "$2,500", answeredAt: "2025-04-13T09:35:00Z" },

  // a3 — Kamola (Screening, Vibecoder)
  { id: "an3_1", applicationId: "a3", questionId: "q1_1", answerText: "I use Claude Code exclusively for the past 4 months. Built a real-time analytics dashboard in one session.", answeredAt: "2025-04-14T11:20:00Z" },
  { id: "an3_2", applicationId: "a3", questionId: "q1_2", answerText: "kamola.dev/portfolio — design-system-heavy projects.", answeredAt: "2025-04-14T11:22:00Z" },
  { id: "an3_3", applicationId: "a3", questionId: "q1_3", answerText: "< 1 hour", answeredAt: "2025-04-14T11:23:00Z" },
  { id: "an3_4", applicationId: "a3", questionId: "q1_4", answerText: "Yes", answeredAt: "2025-04-14T11:24:00Z" },
  { id: "an3_5", applicationId: "a3", questionId: "q1_5", answerText: "$2,800", answeredAt: "2025-04-14T11:25:00Z" },

  // a7 — Zulfiya (Qualified, Vibecoder)
  { id: "an7_1", applicationId: "a7", questionId: "q1_1", answerText: "GitHub Copilot for 2 years. Just got into Cursor last month. Impressed by context-aware completions.", answeredAt: "2025-04-18T10:20:00Z" },
  { id: "an7_2", applicationId: "a7", questionId: "q1_2", answerText: "github.com/zulfiya-ux/admin-kit", answeredAt: "2025-04-18T10:22:00Z" },
  { id: "an7_3", applicationId: "a7", questionId: "q1_3", answerText: "3–6 hours", answeredAt: "2025-04-18T10:23:00Z" },
  { id: "an7_4", applicationId: "a7", questionId: "q1_4", answerText: "Yes, prefer it actually.", answeredAt: "2025-04-18T10:24:00Z" },
  { id: "an7_5", applicationId: "a7", questionId: "q1_5", answerText: "$2,200", answeredAt: "2025-04-18T10:25:00Z" },

  // a12 — Doniyor (Interview, Vibecoder)
  { id: "an12_1", applicationId: "a12", questionId: "q1_1", answerText: "Cursor + Claude Code together. I write the spec in the chat, Claude generates the scaffold, I refine with Cursor.", answeredAt: "2025-04-23T08:40:00Z" },
  { id: "an12_2", applicationId: "a12", questionId: "q1_2", answerText: "github.com/doniyor-k/saas-boilerplate — used by 3 startups.", answeredAt: "2025-04-23T08:42:00Z" },
  { id: "an12_3", applicationId: "a12", questionId: "q1_3", answerText: "< 1 hour", answeredAt: "2025-04-23T08:43:00Z" },
  { id: "an12_4", applicationId: "a12", questionId: "q1_4", answerText: "Yes — I've been freelancing for founders for 2 years.", answeredAt: "2025-04-23T08:44:00Z" },
  { id: "an12_5", applicationId: "a12", questionId: "q1_5", answerText: "$3,800", answeredAt: "2025-04-23T08:45:00Z" },

  // a14 — Mansur (Screening, Sales)
  { id: "an14_1", applicationId: "a14", questionId: "q2_1", answerText: "3 yil IT sohasida B2B sotuv. Asosiy mahsulotlar: HR SaaS, loyiha boshqaruv tizimlari. 45+ korporativ shartnoma yopganman.", answeredAt: "2025-04-25T12:20:00Z" },
  { id: "an14_2", applicationId: "a14", questionId: "q2_2", answerText: "4–7 ta", answeredAt: "2025-04-25T12:22:00Z" },
  { id: "an14_3", applicationId: "a14", questionId: "q2_3", answerText: "Ha, Bitrix24 va AmoCRM ishlatganman.", answeredAt: "2025-04-25T12:23:00Z" },
  { id: "an14_4", applicationId: "a14", questionId: "q2_4", answerText: "6,000,000 – 8,000,000 UZS", answeredAt: "2025-04-25T12:24:00Z" },

  // a19 — Nargiza (Screening, Designer)
  { id: "an19_1", applicationId: "a19", questionId: "q3_1", answerText: "figma.com/@nargiza_q — 12 case studies including a fintech app rebrand.", answeredAt: "2025-04-30T08:50:00Z" },
  { id: "an19_2", applicationId: "a19", questionId: "q3_2", answerText: "2–4 years", answeredAt: "2025-04-30T08:51:00Z" },
  { id: "an19_3", applicationId: "a19", questionId: "q3_3", answerText: "Redesigned the onboarding flow for a mobile app — reduced drop-off from 68% to 31% by cutting steps from 7 to 3 and adding inline validation.", answeredAt: "2025-04-30T08:53:00Z" },
];

// ─── Timeline Events ──────────────────────────────────────────────────────────

export const TIMELINE: TimelineEvent[] = [
  // a1 — Sardor
  { id: "t1_1",  applicationId: "a1", type: "application_started",   description: "Sardor started the application via Telegram bot.",           createdAt: "2025-04-12T10:35:00Z" },
  { id: "t1_2",  applicationId: "a1", type: "answer_submitted",       description: "Completed screening (5/5 questions answered).",              createdAt: "2025-04-12T10:55:00Z" },
  { id: "t1_3",  applicationId: "a1", type: "application_completed",  description: "Application submitted successfully.",                        createdAt: "2025-04-12T10:55:30Z" },
  { id: "t1_4",  applicationId: "a1", type: "stage_changed",          description: "Moved from New → Screening by Aziza K.",   fromStageId: "s1_1", toStageId: "s1_2", createdAt: "2025-04-15T09:00:00Z" },
  { id: "t1_5",  applicationId: "a1", type: "stage_changed",          description: "Moved from Screening → Qualified by Aziza K.", fromStageId: "s1_2", toStageId: "s1_3", createdAt: "2025-04-18T11:00:00Z" },
  { id: "t1_6",  applicationId: "a1", type: "stage_changed",          description: "Moved from Qualified → Test Sent by Aziza K.", fromStageId: "s1_3", toStageId: "s1_4", createdAt: "2025-04-22T10:00:00Z" },
  { id: "t1_7",  applicationId: "a1", type: "stage_changed",          description: "Moved from Test Sent → Test Submitted.",      fromStageId: "s1_4", toStageId: "s1_5", createdAt: "2025-04-25T14:00:00Z" },
  { id: "t1_8",  applicationId: "a1", type: "stage_changed",          description: "Moved from Test Submitted → Interview by Aziza K.", fromStageId: "s1_5", toStageId: "s1_6", createdAt: "2025-04-28T09:00:00Z" },

  // a2 — Jasur
  { id: "t2_1",  applicationId: "a2", type: "application_started",   description: "Jasur started the application via Telegram bot.",           createdAt: "2025-04-13T09:20:00Z" },
  { id: "t2_2",  applicationId: "a2", type: "answer_submitted",       description: "Completed screening (5/5 questions answered).",             createdAt: "2025-04-13T09:35:00Z" },
  { id: "t2_3",  applicationId: "a2", type: "application_completed",  description: "Application submitted successfully.",                       createdAt: "2025-04-13T09:35:30Z" },
  { id: "t2_4",  applicationId: "a2", type: "stage_changed",          description: "Moved from New → Screening by Aziza K.",   fromStageId: "s1_1", toStageId: "s1_2", createdAt: "2025-04-16T10:00:00Z" },
  { id: "t2_5",  applicationId: "a2", type: "stage_changed",          description: "Moved from Screening → Qualified by Aziza K.", fromStageId: "s1_2", toStageId: "s1_3", createdAt: "2025-04-20T09:00:00Z" },
  { id: "t2_6",  applicationId: "a2", type: "stage_changed",          description: "Moved from Qualified → Test Sent by Aziza K.", fromStageId: "s1_3", toStageId: "s1_4", createdAt: "2025-04-24T11:00:00Z" },
  { id: "t2_7",  applicationId: "a2", type: "stage_changed",          description: "Moved from Test Sent → Test Submitted.",      fromStageId: "s1_4", toStageId: "s1_5", createdAt: "2025-04-27T14:00:00Z" },

  // a3 — Kamola
  { id: "t3_1",  applicationId: "a3", type: "application_started",   description: "Kamola started the application via Telegram bot.",          createdAt: "2025-04-14T11:05:00Z" },
  { id: "t3_2",  applicationId: "a3", type: "answer_submitted",       description: "Completed screening (5/5 questions answered).",             createdAt: "2025-04-14T11:25:00Z" },
  { id: "t3_3",  applicationId: "a3", type: "application_completed",  description: "Application submitted successfully.",                       createdAt: "2025-04-14T11:25:30Z" },
  { id: "t3_4",  applicationId: "a3", type: "stage_changed",          description: "Moved from New → Screening by Aziza K.",   fromStageId: "s1_1", toStageId: "s1_2", createdAt: "2025-04-29T10:00:00Z" },

  // a9 — Malika (Rejected)
  { id: "t9_1",  applicationId: "a9", type: "application_started",   description: "Malika started the application via Telegram bot.",          createdAt: "2025-04-20T09:35:00Z" },
  { id: "t9_2",  applicationId: "a9", type: "answer_submitted",       description: "Completed screening (5/5 questions answered).",             createdAt: "2025-04-20T09:55:00Z" },
  { id: "t9_3",  applicationId: "a9", type: "application_completed",  description: "Application submitted successfully.",                       createdAt: "2025-04-20T09:55:30Z" },
  { id: "t9_4",  applicationId: "a9", type: "stage_changed",          description: "Moved from New → Screening by Aziza K.",   fromStageId: "s1_1", toStageId: "s1_2", createdAt: "2025-04-22T10:00:00Z" },
  { id: "t9_5",  applicationId: "a9", type: "stage_changed",          description: "Moved from Screening → Rejected by Aziza K. Reason: skill mismatch.", fromStageId: "s1_2", toStageId: "s1_8", createdAt: "2025-04-24T15:00:00Z" },

  // a10 — Ulugbek (Hired)
  { id: "t10_1", applicationId: "a10", type: "application_started",  description: "Ulugbek started the application via Telegram bot.",         createdAt: "2025-04-21T11:50:00Z" },
  { id: "t10_2", applicationId: "a10", type: "answer_submitted",      description: "Completed screening (5/5 questions answered).",             createdAt: "2025-04-21T12:10:00Z" },
  { id: "t10_3", applicationId: "a10", type: "application_completed", description: "Application submitted successfully.",                       createdAt: "2025-04-21T12:10:30Z" },
  { id: "t10_4", applicationId: "a10", type: "stage_changed",         description: "Moved from New → Screening.",   fromStageId: "s1_1", toStageId: "s1_2", createdAt: "2025-04-23T09:00:00Z" },
  { id: "t10_5", applicationId: "a10", type: "stage_changed",         description: "Moved from Screening → Qualified.", fromStageId: "s1_2", toStageId: "s1_3", createdAt: "2025-04-25T10:00:00Z" },
  { id: "t10_6", applicationId: "a10", type: "stage_changed",         description: "Moved from Qualified → Test Sent.", fromStageId: "s1_3", toStageId: "s1_4", createdAt: "2025-04-27T11:00:00Z" },
  { id: "t10_7", applicationId: "a10", type: "stage_changed",         description: "Moved from Test Sent → Test Submitted.", fromStageId: "s1_4", toStageId: "s1_5", createdAt: "2025-04-29T14:00:00Z" },
  { id: "t10_8", applicationId: "a10", type: "stage_changed",         description: "Moved from Test Submitted → Interview.", fromStageId: "s1_5", toStageId: "s1_6", createdAt: "2025-05-01T09:00:00Z" },
  { id: "t10_9", applicationId: "a10", type: "stage_changed",         description: "Moved from Interview → Hired 🎉 by Dilnoza Y.", fromStageId: "s1_6", toStageId: "s1_7", createdAt: "2025-05-02T10:00:00Z" },

  // a12 — Doniyor (Interview)
  { id: "t12_1", applicationId: "a12", type: "application_started",  description: "Doniyor started the application via Telegram bot.",         createdAt: "2025-04-23T08:25:00Z" },
  { id: "t12_2", applicationId: "a12", type: "answer_submitted",      description: "Completed screening (5/5 questions answered).",             createdAt: "2025-04-23T08:45:00Z" },
  { id: "t12_3", applicationId: "a12", type: "application_completed", description: "Application submitted successfully.",                       createdAt: "2025-04-23T08:45:30Z" },
  { id: "t12_4", applicationId: "a12", type: "stage_changed",         description: "Moved from New → Screening.", fromStageId: "s1_1", toStageId: "s1_2", createdAt: "2025-04-25T10:00:00Z" },
  { id: "t12_5", applicationId: "a12", type: "stage_changed",         description: "Moved from Screening → Qualified.", fromStageId: "s1_2", toStageId: "s1_3", createdAt: "2025-04-27T11:00:00Z" },
  { id: "t12_6", applicationId: "a12", type: "stage_changed",         description: "Moved from Qualified → Test Sent.", fromStageId: "s1_3", toStageId: "s1_4", createdAt: "2025-04-29T09:00:00Z" },
  { id: "t12_7", applicationId: "a12", type: "stage_changed",         description: "Moved from Test Sent → Test Submitted.", fromStageId: "s1_4", toStageId: "s1_5", createdAt: "2025-04-30T16:00:00Z" },
  { id: "t12_8", applicationId: "a12", type: "stage_changed",         description: "Moved from Test Submitted → Interview by Aziza K.", fromStageId: "s1_5", toStageId: "s1_6", createdAt: "2025-05-01T14:00:00Z" },

  // a5, a6, a11 — New applicants (minimal timeline)
  { id: "t5_1",  applicationId: "a5",  type: "application_started",   description: "Nilufar started the application via Telegram bot.",  createdAt: "2025-04-30T08:50:00Z" },
  { id: "t5_2",  applicationId: "a5",  type: "application_completed", description: "Application submitted successfully.",                createdAt: "2025-04-30T09:10:00Z" },
  { id: "t6_1",  applicationId: "a6",  type: "application_started",   description: "Bobur started the application via Telegram bot.",   createdAt: "2025-05-01T09:10:00Z" },
  { id: "t6_2",  applicationId: "a6",  type: "application_completed", description: "Application submitted successfully.",                createdAt: "2025-05-01T09:30:00Z" },
  { id: "t11_1", applicationId: "a11", type: "application_started",   description: "Feruza started the application via Telegram bot.",  createdAt: "2025-05-02T15:05:00Z" },
  { id: "t11_2", applicationId: "a11", type: "application_completed", description: "Application submitted successfully.",                createdAt: "2025-05-02T15:22:00Z" },

  // Sales & Designer timelines
  { id: "t13_1", applicationId: "a13", type: "application_started",   description: "Ozoda started the application via Telegram bot.",   createdAt: "2025-04-24T10:15:00Z" },
  { id: "t13_2", applicationId: "a13", type: "application_completed", description: "Application submitted.",                             createdAt: "2025-04-24T10:35:00Z" },
  { id: "t14_1", applicationId: "a14", type: "application_started",   description: "Mansur started the application via Telegram bot.",  createdAt: "2025-04-25T12:05:00Z" },
  { id: "t14_2", applicationId: "a14", type: "answer_submitted",       description: "Completed screening (4/4 questions answered).",     createdAt: "2025-04-25T12:24:00Z" },
  { id: "t14_3", applicationId: "a14", type: "stage_changed",          description: "Moved from New → Screening by Bobur T.", fromStageId: "s2_1", toStageId: "s2_2", createdAt: "2025-04-29T11:00:00Z" },
  { id: "t16_1", applicationId: "a16", type: "application_started",   description: "Akbar started the application via Telegram bot.",   createdAt: "2025-04-27T09:05:00Z" },
  { id: "t16_2", applicationId: "a16", type: "application_completed", description: "Application submitted.",                             createdAt: "2025-04-27T09:25:00Z" },
  { id: "t16_3", applicationId: "a16", type: "stage_changed",          description: "Moved from New → Screening → Test Sent → Interview.", fromStageId: "s2_1", toStageId: "s2_4", createdAt: "2025-05-01T10:00:00Z" },
  { id: "t18_1", applicationId: "a18", type: "application_started",   description: "Behruz started the application via Telegram bot.",  createdAt: "2025-04-29T13:50:00Z" },
  { id: "t18_2", applicationId: "a18", type: "application_completed", description: "Application submitted.",                             createdAt: "2025-04-29T14:10:00Z" },
  { id: "t19_1", applicationId: "a19", type: "application_started",   description: "Nargiza started the application via Telegram bot.", createdAt: "2025-04-30T08:35:00Z" },
  { id: "t19_2", applicationId: "a19", type: "answer_submitted",       description: "Completed screening (3/3 questions answered).",     createdAt: "2025-04-30T08:53:00Z" },
  { id: "t19_3", applicationId: "a19", type: "stage_changed",          description: "Moved from New → Screening by Aziza K.", fromStageId: "s3_1", toStageId: "s3_2", createdAt: "2025-05-01T09:00:00Z" },
  { id: "t20_1", applicationId: "a20", type: "application_started",   description: "Timur started the application via Telegram bot.",   createdAt: "2025-05-01T10:05:00Z" },
  { id: "t20_2", applicationId: "a20", type: "application_completed", description: "Application submitted.",                             createdAt: "2025-05-01T10:25:00Z" },
  { id: "t20_3", applicationId: "a20", type: "stage_changed",          description: "Moved from New → Screening → Interview by Aziza K.", fromStageId: "s3_1", toStageId: "s3_3", createdAt: "2025-05-02T11:00:00Z" },
];

// ─── Simulate Incoming — 3 rotating fixtures ──────────────────────────────────

export const INCOMING_CANDIDATES: Candidate[] = [
  { id: "_sim1", fullName: "Asilbek Raximov",   phone: "+998 90 111 2233", telegramUsername: "asilbek_r",   telegramFirstName: "Asilbek", language: "uz", city: "Tashkent",  createdAt: new Date().toISOString() },
  { id: "_sim2", fullName: "Mohira Yunusova",   phone: "+998 91 222 3344", telegramUsername: "mohira_y",    telegramFirstName: "Mohira",  language: "uz", city: "Samarkand", createdAt: new Date().toISOString() },
  { id: "_sim3", fullName: "Sanjar Tillayev",   phone: "+998 99 333 4455", telegramUsername: "sanjar_t",    telegramFirstName: "Sanjar",  language: "uz", city: "Tashkent",  createdAt: new Date().toISOString() },
];

export const INCOMING_ANSWERS_TEMPLATE = [
  { questionIndex: 0, text: "Just discovered Claude Code — already built a landing page in 20 minutes. Excited to go deeper." },
  { questionIndex: 1, text: "github.com/incoming/portfolio — work in progress." },
  { questionIndex: 2, text: "1–3 hours" },
  { questionIndex: 3, text: "Yes" },
  { questionIndex: 4, text: "$2,000 – $2,500 (open to negotiation)" },
];

// ─── Telegram Messages ────────────────────────────────────────────────────────

import type { TelegramMessage, InternalNote } from "./types";

export const MESSAGES: TelegramMessage[] = [
  // ── a1 — Sardor (Interview) ──────────────────────────────────────────────
  { id: "m1_1",  candidateId: "c1",  applicationId: "a1", direction: "inbound",  senderType: "candidate", text: "Salom! Ariza yubordim. Jarayon qanday bormoqda?", sentAt: "2025-04-12T11:00:00Z", readByUserIds: ["u1"] },
  { id: "m1_2",  candidateId: "c1",  applicationId: "a1", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Salom Sardor! Arizangiz qabul qilindi va ko'rib chiqilyapti.", sentAt: "2025-04-15T09:05:00Z", readByUserIds: ["u1"] },
  { id: "m1_3",  candidateId: "c1",  applicationId: "a1", direction: "inbound",  senderType: "candidate", text: "Raxmat! Test topshirig'i ham ko'rib chiqildimi?", sentAt: "2025-04-25T15:00:00Z", readByUserIds: ["u1"] },
  { id: "m1_4",  candidateId: "c1",  applicationId: "a1", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Ha, test natijasi juda yaxshi edi! Siz Interview bosqichiga o'tdingiz. Dushanba kuni soat 14:00 da Google Meet orqali suhbatlashamiz.", sentAt: "2025-04-28T09:10:00Z", readByUserIds: ["u1"] },
  { id: "m1_5",  candidateId: "c1",  applicationId: "a1", direction: "inbound",  senderType: "candidate", text: "Zo'r xabar! Meet linkini yuborasizmi?", sentAt: "2025-04-28T09:45:00Z", readByUserIds: ["u1"] },
  { id: "m1_6",  candidateId: "c1",  applicationId: "a1", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Albatta: meet.google.com/hrf-vbcd-xyz — Dushanba, 14:00 (UTC+5). Intervyuga muvaffaqiyat! 🚀", sentAt: "2025-04-28T10:00:00Z", readByUserIds: ["u1"] },
  { id: "m1_7",  candidateId: "c1",  applicationId: "a1", direction: "inbound",  senderType: "candidate", text: "✅ Tayyor, rahmat!", sentAt: "2025-04-28T10:05:00Z", readByUserIds: [] },

  // ── a2 — Jasur (Test Submitted) ──────────────────────────────────────────
  { id: "m2_1",  candidateId: "c2",  applicationId: "a2", direction: "inbound",  senderType: "candidate", text: "Assalomu alaykum! Test topshirig'ini yubordim. Ko'rib chiqasizmi?", sentAt: "2025-04-27T14:30:00Z", readByUserIds: ["u1"] },
  { id: "m2_2",  candidateId: "c2",  applicationId: "a2", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Salom Jasur! Qabul qildik, yaqin 2–3 ish kuni ichida ko'rib chiqamiz.", sentAt: "2025-04-27T16:00:00Z", readByUserIds: ["u1"] },
  { id: "m2_3",  candidateId: "c2",  applicationId: "a2", direction: "inbound",  senderType: "candidate", text: "Taxminan qachon javob berасiz?", sentAt: "2025-04-29T10:00:00Z", readByUserIds: ["u1"] },
  { id: "m2_4",  candidateId: "c2",  applicationId: "a2", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "2–3 ish kuni ichida aniq xabardor qilamiz. Sabr qiling, rahmat!", sentAt: "2025-04-29T10:30:00Z", readByUserIds: ["u1"] },
  { id: "m2_5",  candidateId: "c2",  applicationId: "a2", direction: "inbound",  senderType: "candidate", text: "Ok, kutaman. Raxmat!", sentAt: "2025-04-29T10:35:00Z", readByUserIds: [] },

  // ── a12 — Doniyor (Interview) ────────────────────────────────────────────
  { id: "m12_1", candidateId: "c12", applicationId: "a12", direction: "inbound",  senderType: "candidate", text: "Hello! I submitted my test task yesterday. Looking forward to feedback.", sentAt: "2025-04-30T17:00:00Z", readByUserIds: ["u1"] },
  { id: "m12_2", candidateId: "c12", applicationId: "a12", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Hi Doniyor! We reviewed your SaaS boilerplate — genuinely impressive. Moving you to Interview stage.", sentAt: "2025-05-01T09:00:00Z", readByUserIds: ["u1"] },
  { id: "m12_3", candidateId: "c12", applicationId: "a12", direction: "inbound",  senderType: "candidate", text: "That's great news! When is the interview scheduled?", sentAt: "2025-05-01T09:15:00Z", readByUserIds: ["u1"] },
  { id: "m12_4", candidateId: "c12", applicationId: "a12", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Wednesday at 15:00 Tashkent time. Here's the Meet link: meet.google.com/dky-mnop-rst", sentAt: "2025-05-01T09:30:00Z", readByUserIds: ["u1"] },
  { id: "m12_5", candidateId: "c12", applicationId: "a12", direction: "inbound",  senderType: "candidate", text: "Perfect, I'll be there. Thank you!", sentAt: "2025-05-01T09:40:00Z", readByUserIds: ["u1"] },
  { id: "m12_6", candidateId: "c12", applicationId: "a12", direction: "inbound",  senderType: "candidate", text: "Just to confirm — is it a technical interview or more culture/fit focused?", sentAt: "2025-05-02T08:00:00Z", readByUserIds: [] },

  // ── a10 — Ulugbek (Hired) ────────────────────────────────────────────────
  { id: "m10_1", candidateId: "c10", applicationId: "a10", direction: "inbound",  senderType: "candidate", text: "Salom, oferta haqida yangilik bormi?", sentAt: "2025-05-02T10:30:00Z", readByUserIds: ["u1"] },
  { id: "m10_2", candidateId: "c10", applicationId: "a10", direction: "outbound", senderType: "hr", senderName: "Dilnoza Y.", text: "Salom Ulugbek! Tabriklaymiz 🎉 Siz barcha bosqichlarni muvaffaqiyatli o'tdingiz!", sentAt: "2025-05-02T10:45:00Z", readByUserIds: ["u1"] },
  { id: "m10_3", candidateId: "c10", applicationId: "a10", direction: "outbound", senderType: "hr", senderName: "Dilnoza Y.", text: "Oferta email orqali yuborildi. Dushanba kuni soat 9:00 da ofisga keling.", sentAt: "2025-05-02T10:46:00Z", readByUserIds: ["u1"] },
  { id: "m10_4", candidateId: "c10", applicationId: "a10", direction: "inbound",  senderType: "candidate", text: "Juda xursandman! Bu yangilik uchun katta rahmat! Dushanba kuni bo'laman 💪", sentAt: "2025-05-02T11:00:00Z", readByUserIds: ["u1"] },

  // ── a3 — Kamola (Screening) ──────────────────────────────────────────────
  { id: "m3_1",  candidateId: "c3",  applicationId: "a3", direction: "inbound",  senderType: "candidate", text: "Hi! I just applied for the Vibecoder position. Can you confirm you received my application?", sentAt: "2025-04-14T11:30:00Z", readByUserIds: ["u1"] },
  { id: "m3_2",  candidateId: "c3",  applicationId: "a3", direction: "outbound", senderType: "hr", senderName: "Aziza K.", text: "Hi Kamola! Yes, received. Currently in Screening. We'll be in touch within 2 business days.", sentAt: "2025-04-14T14:00:00Z", readByUserIds: ["u1"] },
  { id: "m3_3",  candidateId: "c3",  applicationId: "a3", direction: "inbound",  senderType: "candidate", text: "Thanks for the quick reply! Happy to do a call whenever.", sentAt: "2025-04-14T14:10:00Z", readByUserIds: [] },

  // ── a16 — Akbar (Interview, Sales) ──────────────────────────────────────
  { id: "m16_1", candidateId: "c16", applicationId: "a16", direction: "inbound",  senderType: "candidate", text: "Salom, intervyu haqida ma'lumot berasizmi?", sentAt: "2025-04-30T09:00:00Z", readByUserIds: ["u1"] },
  { id: "m16_2", candidateId: "c16", applicationId: "a16", direction: "outbound", senderType: "hr", senderName: "Bobur T.", text: "Salom Akbar! Seshanba kuni soat 11:00 da ofisimizda suhbatlashamiz.", sentAt: "2025-04-30T09:30:00Z", readByUserIds: ["u1"] },
  { id: "m16_3", candidateId: "c16", applicationId: "a16", direction: "inbound",  senderType: "candidate", text: "Xop, bo'ladi. Manzilni yuborasizmi?", sentAt: "2025-04-30T09:45:00Z", readByUserIds: ["u1"] },
  { id: "m16_4", candidateId: "c16", applicationId: "a16", direction: "outbound", senderType: "hr", senderName: "Bobur T.", text: "Toshkent sh., Amir Temur ko'chasi 107B, 3-qavat, HR bo'limi. Pasport yoki ID karta olib keling.", sentAt: "2025-04-30T10:00:00Z", readByUserIds: ["u1"] },
  { id: "m16_5", candidateId: "c16", applicationId: "a16", direction: "inbound",  senderType: "candidate", text: "Rahmat! Tayyor bo'laman ✅", sentAt: "2025-04-30T10:05:00Z", readByUserIds: [] },
];

// ─── Internal Notes ───────────────────────────────────────────────────────────

export const NOTES: InternalNote[] = [
  { id: "n1_1",  applicationId: "a1",  userId: "u1", text: "Strong candidate — Claude Code daily for 8 months, built a Relay clone in 2 days. Salary ask $3,000–3,500 fits budget. Recommend proceeding to offer.", createdAt: "2025-04-28T09:30:00Z", isPinned: true },
  { id: "n1_2",  applicationId: "a1",  userId: "u1", text: "Interview Mon 14:00 Meet. Prep: ask about AI-assisted architecture decisions, how he handles ambiguous specs, and a live mini-task (build a form component in 15 min).", createdAt: "2025-04-28T09:35:00Z", isPinned: false },
  { id: "n12_1", applicationId: "a12", userId: "u1", text: "Portfolio exceptional — 3 startups actively using his boilerplate. Salary ask $3,800 is at upper bound. Try to negotiate to $3,400 before sending offer.", createdAt: "2025-05-01T09:45:00Z", isPinned: true },
  { id: "n10_1", applicationId: "a10", userId: "u3", text: "Offer sent 2 May. Start date confirmed: 12 May. Equipment: MacBook Pro M3 ordered, will be ready day one.", createdAt: "2025-05-02T10:50:00Z", isPinned: false },
  { id: "n16_1", applicationId: "a16", userId: "u2", text: "Came highly recommended by Jasur (existing connection). 3 years B2B IT sales — strong closer. Check references before offer.", createdAt: "2025-04-30T09:35:00Z", isPinned: false },
];

// ─── Sources ──────────────────────────────────────────────────────────────────

export const SOURCES: Source[] = [
  { id: "src1_1", vacancyId: "v1", name: "LinkedIn",  botLink: "https://t.me/hireflow_bot?start=v1_src1_1", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
  { id: "src1_2", vacancyId: "v1", name: "Instagram", botLink: "https://t.me/hireflow_bot?start=v1_src1_2", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
  { id: "src1_3", vacancyId: "v1", name: "Telegram",  botLink: "https://t.me/hireflow_bot?start=v1_src1_3", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
  { id: "src2_1", vacancyId: "v2", name: "hh.uz",     botLink: "https://t.me/hireflow_bot?start=v2_src2_1", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
  { id: "src2_2", vacancyId: "v2", name: "Telegram",  botLink: "https://t.me/hireflow_bot?start=v2_src2_2", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
  { id: "src3_1", vacancyId: "v3", name: "Behance",   botLink: "https://t.me/hireflow_bot?start=v3_src3_1", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
  { id: "src3_2", vacancyId: "v3", name: "LinkedIn",  botLink: "https://t.me/hireflow_bot?start=v3_src3_2", isArchived: false, createdAt: "2025-04-10T09:00:00Z" },
];

// ─── Question Templates ───────────────────────────────────────────────────────

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    id: "qt1",
    name: "Basic Info",
    description: "Collect essential contact and availability details from every candidate.",
    isSystem: false,
    createdAt: "2025-01-01T00:00:00Z",
    questions: [
      { id: "qt1-q0", text: "What is your current city of residence?", type: "short-text", orderIndex: 0 },
      { id: "qt1-q1", text: "Do you have a valid work permit / ID?", type: "yes-no", orderIndex: 1 },
      { id: "qt1-q2", text: "When can you start if hired?", type: "short-text", orderIndex: 2 },
    ],
  },
  {
    id: "qt2",
    name: "Work Experience",
    description: "Understand candidates' professional background and readiness.",
    isSystem: false,
    createdAt: "2025-01-01T00:00:00Z",
    questions: [
      { id: "qt2-q0", text: "How many years of relevant work experience do you have?", type: "single-choice", options: ["< 1 year", "1–2 years", "3–5 years", "5+ years"], orderIndex: 0 },
      { id: "qt2-q1", text: "Briefly describe your most recent role and main responsibilities.", type: "long-text", orderIndex: 1 },
      { id: "qt2-q2", text: "What is your expected monthly salary (USD)?", type: "short-text", orderIndex: 2 },
    ],
  },
  {
    id: "qt3",
    name: "Vibecoder Pack",
    description: "Screens AI-native developers — tooling fluency, speed, and founder comfort.",
    isSystem: false,
    createdAt: "2025-01-01T00:00:00Z",
    questions: [
      { id: "qt3-q0", text: "Which AI coding tools do you use daily?", type: "single-choice", options: ["Claude Code", "Cursor", "Copilot", "Lovable / v0", "None yet"], orderIndex: 0 },
      { id: "qt3-q1", text: "Share a link to a project you built (GitHub, live URL, or demo).", type: "short-text", orderIndex: 1 },
      { id: "qt3-q2", text: "How long does it typically take you to ship a working prototype?", type: "single-choice", options: ["< 2 hours", "Half a day", "1–2 days", "3+ days"], orderIndex: 2 },
      { id: "qt3-q3", text: "Are you comfortable working directly with a non-technical founder?", type: "yes-no", orderIndex: 3 },
    ],
  },
  {
    id: "qt4",
    name: "Sales Pack",
    description: "Screens B2B sales candidates — pipeline discipline, deal size, and CRM fluency.",
    isSystem: false,
    createdAt: "2025-01-01T00:00:00Z",
    questions: [
      { id: "qt4-q0", text: "Do you have B2B sales experience?", type: "yes-no", orderIndex: 0 },
      { id: "qt4-q1", text: "On average, how many deals did you close per month in your last role?", type: "single-choice", options: ["1–2", "3–5", "6–10", "10+"], orderIndex: 1 },
      { id: "qt4-q2", text: "Which CRM tools have you used?", type: "short-text", orderIndex: 2 },
      { id: "qt4-q3", text: "What is the largest deal (USD) you have personally closed?", type: "short-text", orderIndex: 3 },
    ],
  },
  {
    id: "qt5",
    name: "Culture Fit",
    description: "Assesses working style, autonomy, and remote readiness.",
    isSystem: false,
    createdAt: "2025-01-01T00:00:00Z",
    questions: [
      { id: "qt5-q0", text: "Describe your ideal working environment in 1–2 sentences.", type: "long-text", orderIndex: 0 },
      { id: "qt5-q1", text: "How do you handle tight deadlines and shifting priorities?", type: "long-text", orderIndex: 1 },
      { id: "qt5-q2", text: "Are you comfortable working fully remote with async communication?", type: "yes-no", orderIndex: 2 },
    ],
  },
];

// ─── Automation Rules ─────────────────────────────────────────────────────────

export const AUTOMATION_RULES: AutomationRule[] = [
  // Vibecoder (v1)
  {
    id: "ar1_1",
    vacancyId: "v1",
    name: "Welcome message on apply",
    isEnabled: true,
    triggerType: "application_submitted",
    actionType: "send_message",
    actionMessageText: "Salom! Vibecoder arizangiz qabul qilindi. Tez orada ko'rib chiqamiz! 🚀",
    createdAt: "2025-04-10T09:00:00Z",
  },
  {
    id: "ar1_2",
    vacancyId: "v1",
    name: "Move to Screening when test sent",
    isEnabled: true,
    triggerType: "stage_entered",
    triggerStageId: "s1_4",
    actionType: "send_message",
    actionMessageText: "Test topshirig'i yuborildi! Iltimos, 48 soat ichida bajarib yuboring.",
    createdAt: "2025-04-10T09:00:00Z",
  },
  {
    id: "ar1_3",
    vacancyId: "v1",
    name: "Notify on interview",
    isEnabled: true,
    triggerType: "stage_entered",
    triggerStageId: "s1_6",
    actionType: "send_message",
    actionMessageText: "Tabriklaymiz! Siz Interview bosqichiga o'tdingiz. Tez orada bog'lanamiz.",
    createdAt: "2025-04-10T09:00:00Z",
  },
  {
    id: "ar1_4",
    vacancyId: "v1",
    name: "Rejection message",
    isEnabled: false,
    triggerType: "stage_entered",
    triggerStageId: "s1_8",
    actionType: "send_message",
    actionMessageText: "Arizangiz uchun rahmat. Afsuski, bu safar tanlov boshqa nomzod foydasiga yakunlandi.",
    createdAt: "2025-04-10T09:00:00Z",
  },

  // Sales Manager (v2)
  {
    id: "ar2_1",
    vacancyId: "v2",
    name: "Welcome on apply",
    isEnabled: true,
    triggerType: "application_submitted",
    actionType: "send_message",
    actionMessageText: "Salom! Sales Manager arizangiz qabul qilindi.",
    createdAt: "2025-04-15T10:00:00Z",
  },
  {
    id: "ar2_2",
    vacancyId: "v2",
    name: "Interview notification",
    isEnabled: true,
    triggerType: "stage_entered",
    triggerStageId: "s2_4",
    actionType: "send_message",
    actionMessageText: "Tabriklaymiz! Intervyuga taklif etilasiz.",
    createdAt: "2025-04-15T10:00:00Z",
  },
];

// ─── Test Tasks ───────────────────────────────────────────────────────────────

export const TEST_TASKS: TestTask[] = [
  {
    id: "tt1",
    vacancyId: "v1",
    title: "Frontend Component Challenge",
    description: "Build a reusable Button component in React with TypeScript. It must support: primary/secondary/ghost variants, loading state, disabled state, and an optional left icon slot. Include a short README. Submit via GitHub repo link.",
    dueInDays: 3,
  },
  {
    id: "tt2",
    vacancyId: "v1",
    title: "Live Coding Session Prep",
    description: "Review the HireFlow codebase (GitHub link in the message). Be ready to add a new feature live during the interview. No preparation needed — we want to see your natural problem-solving approach.",
    dueInDays: 1,
  },
  {
    id: "tt3",
    vacancyId: "v2",
    title: "Sales Scenario Write-up",
    description: "A potential client says: 'Your price is too high, our current vendor is cheaper.' Write a 200-word response that keeps the conversation moving toward a deal.",
    dueInDays: 2,
  },
];

// ─── Test Task Assignments ────────────────────────────────────────────────────

export const TEST_TASK_ASSIGNMENTS: TestTaskAssignment[] = [
  {
    id: "tta1",
    taskId: "tt1",
    applicationId: "a1",
    assignedAt: "2025-04-26T10:00:00Z",
    dueAt: "2025-04-29T10:00:00Z",
    status: "submitted",
    submissionNote: "https://github.com/sardor-dev/button-component",
  },
  {
    id: "tta2",
    taskId: "tt1",
    applicationId: "a3",
    assignedAt: "2025-04-27T09:00:00Z",
    dueAt: "2025-04-30T09:00:00Z",
    status: "pending",
  },
  {
    id: "tta3",
    taskId: "tt3",
    applicationId: "a16",
    assignedAt: "2025-04-30T10:00:00Z",
    dueAt: "2025-05-02T10:00:00Z",
    status: "passed",
    submissionNote: "Strong answer — mentioned value-based selling and TCO argument. Hire.",
  },
];
