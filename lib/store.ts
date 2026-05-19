import { create } from "zustand";
import type {
  UUID, Vacancy, VacancyStage, Candidate, Application,
  ScreeningQuestion, ScreeningAnswer, TimelineEvent, User,
  TelegramMessage, InternalNote, Source, QuestionTemplate, CreateVacancyInput,
  AutomationRule, TestTask, TestTaskAssignment,
} from "./types";
import {
  USERS, VACANCIES, STAGES, CANDIDATES, APPLICATIONS,
  QUESTIONS, ANSWERS, TIMELINE, MESSAGES, NOTES,
  INCOMING_CANDIDATES, INCOMING_ANSWERS_TEMPLATE,
  SOURCES, QUESTION_TEMPLATES,
  AUTOMATION_RULES, TEST_TASKS, TEST_TASK_ASSIGNMENTS,
} from "./mockData";

let _simIndex = 0;
let _simCounter = 0;
let _automationDepth = 0;
const _automationVisited = new Set<string>();

const MAX_AUTOMATION_DEPTH = 10;
const makeId = (prefix: string) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

type Store = {
  // ── State ────────────────────────────────────────────
  currentUserId: UUID;
  users: User[];
  vacancies: Vacancy[];
  stages: VacancyStage[];
  candidates: Candidate[];
  applications: Application[];
  questions: ScreeningQuestion[];
  answers: ScreeningAnswer[];
  timeline: TimelineEvent[];
  messages: TelegramMessage[];
  notes: InternalNote[];
  sources: Source[];
  questionTemplates: QuestionTemplate[];
  automations: AutomationRule[];
  testTasks: TestTask[];
  testTaskAssignments: TestTaskAssignment[];

  // ── Actions ──────────────────────────────────────────
  moveApplicationToStage: (applicationId: UUID, toStageId: UUID) => void;
  simulateIncomingApplication: (vacancyId: UUID) => void;
  sendMessage: (applicationId: UUID, text: string) => void;
  simulateIncomingMessage: (applicationId: UUID) => void;
  addNote: (applicationId: UUID, text: string) => void;
  togglePinNote: (noteId: UUID) => void;
  markConversationRead: (applicationId: UUID) => void;
  createVacancy: (input: CreateVacancyInput) => string;
  updateVacancy: (id: UUID, patch: Partial<Pick<Vacancy, "title" | "department" | "workType" | "employmentType" | "location" | "salaryMin" | "salaryMax" | "description" | "status" | "language" | "responsibleHrId" | "introMessage" | "successMessage">>) => void;
  addQuestion: (vacancyId: UUID, q: { text: string; type: ScreeningQuestion["type"]; options?: string[] }) => void;
  removeQuestion: (questionId: UUID) => void;
  updateQuestion: (questionId: UUID, patch: Partial<Pick<ScreeningQuestion, "text" | "type" | "options">>) => void;
  reorderQuestions: (vacancyId: UUID, orderedIds: UUID[]) => void;
  addStage: (vacancyId: UUID, s: { name: string; color: string; isFinal: boolean; isRejected: boolean }) => void;
  removeStage: (stageId: UUID) => void;
  updateStage: (stageId: UUID, patch: Partial<Pick<VacancyStage, "name" | "color" | "isFinal" | "isRejected">>) => void;
  reorderStages: (vacancyId: UUID, orderedIds: UUID[]) => void;
  addSource: (vacancyId: UUID, name: string) => void;
  removeSource: (sourceId: UUID) => void;
  createAutomation: (vacancyId: UUID, rule: Omit<AutomationRule, "id" | "vacancyId" | "createdAt">) => void;
  removeAutomation: (id: UUID) => void;
  toggleAutomation: (id: UUID) => void;
  createTestTask: (vacancyId: UUID, task: Omit<TestTask, "id" | "vacancyId">) => void;
  removeTestTask: (id: UUID) => void;
  assignTestTask: (applicationId: UUID, taskId: UUID) => void;
  updateTestTaskAssignment: (id: UUID, patch: Partial<Pick<TestTaskAssignment, "status" | "submissionNote">>) => void;
  sendBatchMessage: (applicationIds: UUID[], text: string) => void;

  // ── Selectors ────────────────────────────────────────
  getVacancyById: (id: UUID) => Vacancy | undefined;
  getStagesForVacancy: (vacancyId: UUID) => VacancyStage[];
  getApplicationsForVacancy: (vacancyId: UUID) => Application[];
  getApplicationsForStage: (vacancyId: UUID, stageId: UUID) => Application[];
  getCandidateForApplication: (applicationId: UUID) => Candidate | undefined;
  getAnswersForApplication: (applicationId: UUID) => Array<{ question: ScreeningQuestion; answer: ScreeningAnswer }>;
  getTimelineForApplication: (applicationId: UUID) => TimelineEvent[];
  getMessagesForApplication: (applicationId: UUID) => TelegramMessage[];
  getNotesForApplication: (applicationId: UUID) => InternalNote[];
  getUnreadCount: () => number;
  getTotalCandidatesForVacancy: (vacancyId: UUID) => number;
  getNewCandidatesForVacancy: (vacancyId: UUID) => number;
  getSourcesForVacancy: (vacancyId: UUID) => Source[];
  getAutomationsForVacancy: (vacancyId: UUID) => AutomationRule[];
  getTestTasksForVacancy: (vacancyId: UUID) => TestTask[];
  getTestTaskAssignmentsForApplication: (applicationId: UUID) => Array<{ task: TestTask; assignment: TestTaskAssignment }>;
  getApplicationsInStage: (stageId: UUID) => Application[];
  getAssignmentsForTask: (taskId: UUID) => TestTaskAssignment[];
};

const SIM_REPLIES = [
  "Thanks for the update! Looking forward to hearing from you.",
  "Got it. I'll be available whenever works best for the team.",
  "Understood. Should I prepare anything specific for the next step?",
  "Great, thank you! When can I expect the next update?",
  "Sounds good. I'm very excited about this opportunity.",
];
let _replyIndex = 0;

export const useStore = create<Store>((set, get) => ({
  // ── Initial state ────────────────────────────────────
  currentUserId: "u1",
  users: USERS,
  vacancies: VACANCIES,
  stages: STAGES,
  candidates: CANDIDATES,
  applications: APPLICATIONS,
  questions: QUESTIONS,
  answers: ANSWERS,
  timeline: TIMELINE,
  messages: MESSAGES,
  notes: NOTES,
  sources: SOURCES,
  questionTemplates: QUESTION_TEMPLATES,
  automations: AUTOMATION_RULES,
  testTasks: TEST_TASKS,
  testTaskAssignments: TEST_TASK_ASSIGNMENTS,

  // ── Actions ──────────────────────────────────────────
  moveApplicationToStage(applicationId, toStageId) {
    const { applications, stages, users, currentUserId } = get();
    const app = applications.find((a) => a.id === applicationId);
    if (!app || app.currentStageId === toStageId) return;

    const fromStage = stages.find((s) => s.id === app.currentStageId);
    const toStage = stages.find((s) => s.id === toStageId);
    if (!toStage || toStage.vacancyId !== app.vacancyId) return;

    const hr = users.find((u) => u.id === currentUserId);
    const now = new Date().toISOString();

    const event: TimelineEvent = {
      id: makeId("te"),
      applicationId,
      type: "stage_changed",
      description: `Moved from ${fromStage?.name ?? "?"} → ${toStage?.name ?? "?"} by ${hr?.name ?? "HR"}.`,
      fromStageId: app.currentStageId,
      toStageId,
      createdAt: now,
    };

    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, currentStageId: toStageId, lastActivityAt: now } : a
      ),
      timeline: [...s.timeline, event],
    }));

    // Fire automation rules
    const { automations } = get();
    const triggeredRules = automations.filter(
      (r) => r.isEnabled && r.triggerType === "stage_entered" && r.triggerStageId === toStageId && r.vacancyId === app.vacancyId
    );
    if (_automationDepth >= MAX_AUTOMATION_DEPTH) return;

    const isRootAutomationRun = _automationDepth === 0;
    if (isRootAutomationRun) _automationVisited.clear();
    _automationDepth++;
    try {
      for (const rule of triggeredRules) {
        const visitKey = `${applicationId}:${rule.id}:${toStageId}`;
        if (_automationVisited.has(visitKey)) continue;
        _automationVisited.add(visitKey);

        if (rule.actionType === "send_message") {
          const messageText = rule.actionMessageText?.trim();
          if (messageText) get().sendMessage(applicationId, messageText);
        } else if (rule.actionType === "move_to_stage" && rule.actionStageId) {
          get().moveApplicationToStage(applicationId, rule.actionStageId);
        }
      }
    } finally {
      _automationDepth--;
      if (isRootAutomationRun) _automationVisited.clear();
    }
  },

  simulateIncomingApplication(vacancyId) {
    const { stages, questions } = get();
    const vacancyStages = stages
      .filter((s) => s.vacancyId === vacancyId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const firstStage = vacancyStages[0];
    if (!firstStage) return;

    const template = INCOMING_CANDIDATES[_simIndex % INCOMING_CANDIDATES.length];
    _simIndex++;
    _simCounter++;

    const suffix = _simCounter > 1 ? ` ${_simCounter}` : "";
    const now = new Date().toISOString();
    const candidateId = makeId("sim_c");
    const applicationId = makeId("sim_a");

    const newCandidate: Candidate = {
      ...template,
      id: candidateId,
      fullName: template.fullName + suffix,
      telegramUsername: template.telegramUsername + (_simCounter > 1 ? _simCounter : ""),
      createdAt: now,
    };

    const newApplication: Application = {
      id: applicationId,
      candidateId,
      vacancyId,
      currentStageId: firstStage.id,
      appliedAt: now,
      lastActivityAt: now,
      status: "submitted",
    };

    const vacancyQuestions = questions
      .filter((q) => q.vacancyId === vacancyId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const newAnswers: ScreeningAnswer[] = vacancyQuestions
      .slice(0, Math.min(vacancyQuestions.length, INCOMING_ANSWERS_TEMPLATE.length))
      .map((q, i) => ({
        id: makeId(`sim_an_${i}`),
        applicationId,
        questionId: q.id,
        answerText: INCOMING_ANSWERS_TEMPLATE[i].text,
        answeredAt: now,
      }));

    const newEvents: TimelineEvent[] = [
      {
        id: makeId("sim_te_start"),
        applicationId,
        type: "application_started",
        description: `${newCandidate.fullName} started the application via Telegram bot.`,
        createdAt: now,
      },
      {
        id: makeId("sim_te_done"),
        applicationId,
        type: "application_completed",
        description: "Application submitted successfully.",
        createdAt: now,
      },
    ];

    const greeting: TelegramMessage = {
      id: makeId("sim_msg"),
      candidateId,
      applicationId,
      direction: "inbound",
      senderType: "candidate",
      text: "Salom! Arizamni yubordim. Ko'rib chiqasizmi? 🙏",
      sentAt: now,
      readByUserIds: [],
    };

    set((s) => ({
      candidates: [...s.candidates, newCandidate],
      applications: [...s.applications, newApplication],
      answers: [...s.answers, ...newAnswers],
      timeline: [...s.timeline, ...newEvents],
      messages: [...s.messages, greeting],
    }));
  },

  sendMessage(applicationId, text) {
    const messageText = text.trim();
    if (!messageText) return;

    const { currentUserId, users, applications } = get();
    const hr = users.find((u) => u.id === currentUserId);
    const app = applications.find((a) => a.id === applicationId);
    const now = new Date().toISOString();

    const msg: TelegramMessage = {
      id: makeId("msg"),
      candidateId: app?.candidateId ?? "",
      applicationId,
      direction: "outbound",
      senderType: "hr",
      senderName: hr ? `${hr.name.split(" ")[0]} ${hr.name.split(" ")[1]?.[0] ?? ""}.` : "HR",
      text: messageText,
      sentAt: now,
      readByUserIds: [currentUserId],
    };

    set((s) => ({
      messages: [...s.messages, msg],
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, lastActivityAt: now } : a
      ),
    }));
  },

  simulateIncomingMessage(applicationId) {
    const now = new Date().toISOString();
    const reply = SIM_REPLIES[_replyIndex % SIM_REPLIES.length];
    _replyIndex++;
    const app = get().applications.find((a) => a.id === applicationId);

    const msg: TelegramMessage = {
      id: makeId("sim_reply"),
      candidateId: app?.candidateId ?? "",
      applicationId,
      direction: "inbound",
      senderType: "candidate",
      text: reply,
      sentAt: now,
      readByUserIds: [],
    };

    set((s) => ({
      messages: [...s.messages, msg],
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, lastActivityAt: now } : a
      ),
    }));
  },

  addNote(applicationId, text) {
    const { currentUserId } = get();
    const note: InternalNote = {
      id: makeId("note"),
      applicationId,
      userId: currentUserId,
      text,
      createdAt: new Date().toISOString(),
      isPinned: false,
    };
    set((s) => ({ notes: [...s.notes, note] }));
  },

  togglePinNote(noteId) {
    set((s) => ({
      notes: s.notes.map((n) => n.id === noteId ? { ...n, isPinned: !n.isPinned } : n),
    }));
  },

  markConversationRead(applicationId) {
    const { currentUserId } = get();
    set((s) => ({
      messages: s.messages.map((m) =>
        m.applicationId === applicationId && !m.readByUserIds.includes(currentUserId)
          ? { ...m, readByUserIds: [...m.readByUserIds, currentUserId] }
          : m
      ),
    }));
  },

  createVacancy(input) {
    const vacancyId = makeId("v");
    const now = new Date().toISOString();

    const newStages: VacancyStage[] = input.stages.map((s, i) => ({
      id: makeId("st"),
      vacancyId,
      name: s.name,
      color: s.color,
      isFinal: s.isFinal,
      isRejected: s.isRejected,
      orderIndex: i,
    }));

    const newVacancy: Vacancy = {
      id: vacancyId,
      title: input.title,
      department: input.department,
      workType: input.workType,
      employmentType: input.employmentType,
      location: input.location,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      description: input.description,
      status: "active",
      language: input.language,
      responsibleHrId: input.responsibleHrId,
      stageIds: newStages.map((s) => s.id),
      createdAt: now,
      introMessage: input.introMessage,
      successMessage: input.successMessage,
    };

    const newQuestions: ScreeningQuestion[] = input.questions.map((q, i) => ({
      id: makeId("q"),
      vacancyId,
      text: q.text,
      type: q.type,
      options: q.options,
      orderIndex: i,
    }));

    const newSources: Source[] = input.sources.map((s) => {
      const id = makeId("src");
      return {
        id,
        vacancyId,
        name: s.name,
        botLink: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "data365_HR_bot"}?start=${vacancyId}_${id}`,
      };
    });

    set((s) => ({
      vacancies: [...s.vacancies, newVacancy],
      stages: [...s.stages, ...newStages],
      questions: [...s.questions, ...newQuestions],
      sources: [...s.sources, ...newSources],
    }));

    return vacancyId;
  },

  updateVacancy(id, patch) {
    // #10: reject NaN / non-finite salary values to prevent silent corruption
    const safePatch = { ...patch };
    if ("salaryMin" in safePatch && (!Number.isFinite(safePatch.salaryMin) || isNaN(safePatch.salaryMin!))) {
      delete safePatch.salaryMin;
    }
    if ("salaryMax" in safePatch && (!Number.isFinite(safePatch.salaryMax) || isNaN(safePatch.salaryMax!))) {
      delete safePatch.salaryMax;
    }
    set((s) => ({
      vacancies: s.vacancies.map((v) => v.id === id ? { ...v, ...safePatch } : v),
    }));
  },

  addQuestion(vacancyId, q) {
    const { questions } = get();
    const existing = questions.filter((x) => x.vacancyId === vacancyId);
    const newQ: ScreeningQuestion = {
      id: makeId("q"),
      vacancyId,
      text: q.text,
      type: q.type,
      options: q.options,
      orderIndex: existing.length,
    };
    set((s) => ({ questions: [...s.questions, newQ] }));
  },

  removeQuestion(questionId) {
    set((s) => ({
      questions: s.questions.filter((q) => q.id !== questionId),
      answers: s.answers.filter((a) => a.questionId !== questionId),
    }));
  },

  updateQuestion(questionId, patch) {
    set((s) => ({
      questions: s.questions.map((q) => q.id === questionId ? { ...q, ...patch } : q),
    }));
  },

  reorderQuestions(vacancyId, orderedIds) {
    set((s) => ({
      questions: s.questions.map((q) => {
        if (q.vacancyId !== vacancyId) return q;
        const idx = orderedIds.indexOf(q.id);
        return idx === -1 ? q : { ...q, orderIndex: idx };
      }),
    }));
  },

  addStage(vacancyId, s) {
    const { stages, vacancies } = get();
    const existing = stages.filter((x) => x.vacancyId === vacancyId);
    const newStage: VacancyStage = {
      id: makeId("st"),
      vacancyId,
      name: s.name,
      color: s.color,
      isFinal: s.isFinal,
      isRejected: s.isRejected,
      orderIndex: existing.length,
    };
    set((state) => ({
      stages: [...state.stages, newStage],
      vacancies: state.vacancies.map((v) =>
        v.id === vacancyId ? { ...v, stageIds: [...v.stageIds, newStage.id] } : v
      ),
    }));
  },

  removeStage(stageId) {
    const { applications, stages } = get();
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    const vacancyStages = stages.filter((s) => s.vacancyId === stage.vacancyId);
    // Block if last stage or applications currently in this stage (#18)
    const appsInStage = applications.filter((a) => a.currentStageId === stageId);
    if (vacancyStages.length <= 1 || appsInStage.length > 0) return;

    set((s) => ({
      stages: s.stages.filter((x) => x.id !== stageId),
      vacancies: s.vacancies.map((v) =>
        v.id === stage.vacancyId ? { ...v, stageIds: v.stageIds.filter((id) => id !== stageId) } : v
      ),
      // Cascade: remove automations referencing this stage (#19)
      automations: s.automations.filter((a) => a.triggerStageId !== stageId && a.actionStageId !== stageId),
    }));
  },

  updateStage(stageId, patch) {
    set((s) => ({
      stages: s.stages.map((x) => x.id === stageId ? { ...x, ...patch } : x),
    }));
  },

  reorderStages(vacancyId, orderedIds) {
    set((s) => ({
      stages: s.stages.map((x) => {
        if (x.vacancyId !== vacancyId) return x;
        const idx = orderedIds.indexOf(x.id);
        return idx === -1 ? x : { ...x, orderIndex: idx };
      }),
      vacancies: s.vacancies.map((v) =>
        v.id === vacancyId ? { ...v, stageIds: orderedIds } : v
      ),
    }));
  },

  addSource(vacancyId, name) {
    const id = makeId("src");
    const newSource: Source = {
      id,
      vacancyId,
      name,
      botLink: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "data365_HR_bot"}?start=${vacancyId}_${id}`,
    };
    set((s) => ({ sources: [...s.sources, newSource] }));
  },

  removeSource(sourceId) {
    set((s) => ({ sources: s.sources.filter((x) => x.id !== sourceId) }));
  },

  // ── Selectors ────────────────────────────────────────
  getVacancyById(id) {
    return get().vacancies.find((v) => v.id === id);
  },

  getStagesForVacancy(vacancyId) {
    return get().stages.filter((s) => s.vacancyId === vacancyId).sort((a, b) => a.orderIndex - b.orderIndex);
  },

  getApplicationsForVacancy(vacancyId) {
    return get().applications.filter((a) => a.vacancyId === vacancyId);
  },

  getApplicationsForStage(vacancyId, stageId) {
    return get().applications.filter((a) => a.vacancyId === vacancyId && a.currentStageId === stageId);
  },

  getCandidateForApplication(applicationId) {
    const app = get().applications.find((a) => a.id === applicationId);
    if (!app) return undefined;
    return get().candidates.find((c) => c.id === app.candidateId);
  },

  getAnswersForApplication(applicationId) {
    const { answers, questions } = get();
    return answers
      .filter((a) => a.applicationId === applicationId)
      .map((answer) => ({ question: questions.find((q) => q.id === answer.questionId)!, answer }))
      .filter((pair) => pair.question != null)
      .sort((a, b) => a.question.orderIndex - b.question.orderIndex);
  },

  getTimelineForApplication(applicationId) {
    return get().timeline
      .filter((t) => t.applicationId === applicationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getMessagesForApplication(applicationId) {
    return get().messages
      .filter((m) => m.applicationId === applicationId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  },

  getNotesForApplication(applicationId) {
    return get().notes
      .filter((n) => n.applicationId === applicationId)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  },

  getUnreadCount() {
    const { messages, currentUserId } = get();
    const seen = new Set<string>();
    let count = 0;
    for (const m of messages) {
      const key = m.applicationId ?? m.candidateId;
      if (m.direction === "inbound" && !m.readByUserIds.includes(currentUserId) && !seen.has(key)) {
        seen.add(key);
        count++;
      }
    }
    return count;
  },

  getTotalCandidatesForVacancy(vacancyId) {
    return get().applications.filter((a) => a.vacancyId === vacancyId).length;
  },

  getNewCandidatesForVacancy(vacancyId) {
    const { applications, stages } = get();
    const firstStage = stages
      .filter((s) => s.vacancyId === vacancyId)
      .sort((a, b) => a.orderIndex - b.orderIndex)[0];
    if (!firstStage) return 0;
    return applications.filter((a) => a.vacancyId === vacancyId && a.currentStageId === firstStage.id).length;
  },

  getSourcesForVacancy(vacancyId) {
    return get().sources.filter((s) => s.vacancyId === vacancyId);
  },

  createAutomation(vacancyId, rule) {
    const name = rule.name.trim();
    const triggerStageId = rule.triggerType === "stage_entered" ? rule.triggerStageId : undefined;
    const actionStageId = rule.actionType === "move_to_stage" ? rule.actionStageId : undefined;
    const actionMessageText = rule.actionType === "send_message" ? rule.actionMessageText?.trim() : undefined;

    if (!name) return;
    if (!get().vacancies.some((v) => v.id === vacancyId)) return;
    if (rule.triggerType === "stage_entered" && !triggerStageId) return;
    if (rule.actionType === "move_to_stage" && !actionStageId) return;
    if (rule.actionType === "send_message" && !actionMessageText) return;

    const stages = get().stages;
    if (triggerStageId && !stages.some((s) => s.id === triggerStageId && s.vacancyId === vacancyId)) return;
    if (actionStageId && !stages.some((s) => s.id === actionStageId && s.vacancyId === vacancyId)) return;

    const duplicate = get().automations.some((existing) => (
      existing.vacancyId === vacancyId &&
      existing.triggerType === rule.triggerType &&
      (existing.triggerStageId ?? "") === (triggerStageId ?? "") &&
      existing.actionType === rule.actionType &&
      (existing.actionStageId ?? "") === (actionStageId ?? "") &&
      (existing.actionMessageText?.trim() ?? "") === (actionMessageText ?? "")
    ));
    if (duplicate) return;

    const newRule: AutomationRule = {
      ...rule,
      id: makeId("ar"),
      vacancyId,
      createdAt: new Date().toISOString(),
      name,
      triggerStageId,
      actionStageId,
      actionMessageText,
    };
    set((s) => ({ automations: [...s.automations, newRule] }));
  },

  removeAutomation(id) {
    set((s) => ({ automations: s.automations.filter((a) => a.id !== id) }));
  },

  toggleAutomation(id) {
    set((s) => ({ automations: s.automations.map((a) => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a) }));
  },

  createTestTask(vacancyId, task) {
    const newTask: TestTask = { id: makeId("tt"), vacancyId, ...task };
    set((s) => ({ testTasks: [...s.testTasks, newTask] }));
  },

  removeTestTask(id) {
    // Block if there are active assignments for this task (#57)
    const assignments = get().testTaskAssignments.filter((a) => a.taskId === id);
    if (assignments.length > 0) return;

    set((s) => ({
      testTasks: s.testTasks.filter((t) => t.id !== id),
    }));
  },

  assignTestTask(applicationId, taskId) {
    const task = get().testTasks.find((t) => t.id === taskId);
    if (!task) return;
    const alreadyAssigned = get().testTaskAssignments.some((a) => a.applicationId === applicationId && a.taskId === taskId);
    if (alreadyAssigned) return;

    const assignedAt = new Date().toISOString();
    const dueAt = new Date(Date.now() + task.dueInDays * 86400000).toISOString();
    const assignment: TestTaskAssignment = { id: makeId("tta"), taskId, applicationId, assignedAt, dueAt, status: "pending" };
    set((s) => ({ testTaskAssignments: [...s.testTaskAssignments, assignment] }));
  },

  updateTestTaskAssignment(id, patch) {
    set((s) => ({ testTaskAssignments: s.testTaskAssignments.map((a) => a.id === id ? { ...a, ...patch } : a) }));
  },

  sendBatchMessage(applicationIds, text) {
    const messageText = text.trim();
    if (!messageText) return;

    const { currentUserId, users, applications } = get();
    const hr = users.find((u) => u.id === currentUserId);
    const now = new Date().toISOString();
    const newMessages = applicationIds.map((applicationId) => {
      const app = applications.find((a) => a.id === applicationId);
      return {
        id: makeId("msg_batch"),
        candidateId: app?.candidateId ?? "",
        applicationId,
        direction: "outbound" as const,
        senderType: "hr" as const,
        senderName: hr ? `${hr.name.split(" ")[0]} ${hr.name.split(" ")[1]?.[0] ?? ""}.` : "HR",
        text: messageText,
        sentAt: now,
        readByUserIds: [currentUserId],
      };
    });
    set((s) => ({
      messages: [...s.messages, ...newMessages],
      applications: s.applications.map((a) =>
        applicationIds.includes(a.id) ? { ...a, lastActivityAt: now } : a
      ),
    }));
  },

  getAutomationsForVacancy(vacancyId) {
    return get().automations.filter((a) => a.vacancyId === vacancyId);
  },

  getTestTasksForVacancy(vacancyId) {
    return get().testTasks.filter((t) => t.vacancyId === vacancyId);
  },

  getTestTaskAssignmentsForApplication(applicationId) {
    const { testTaskAssignments, testTasks } = get();
    return testTaskAssignments
      .filter((a) => a.applicationId === applicationId)
      .map((assignment) => ({ task: testTasks.find((t) => t.id === assignment.taskId)!, assignment }))
      .filter((pair) => pair.task != null);
  },

  // #18 selector: applications currently in a given stage
  getApplicationsInStage(stageId) {
    return get().applications.filter((a) => a.currentStageId === stageId);
  },

  // #57 selector: assignments for a given test task
  getAssignmentsForTask(taskId) {
    return get().testTaskAssignments.filter((a) => a.taskId === taskId);
  },
}));
