import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../lib/db/client";
import * as schema from "../lib/db/schema";
import {
  USERS,
  VACANCIES,
  STAGES,
  QUESTIONS,
  CANDIDATES,
  APPLICATIONS,
  ANSWERS,
  TIMELINE,
  MESSAGES,
  NOTES,
  SOURCES,
  AUTOMATION_RULES,
  TEST_TASKS,
  TEST_TASK_ASSIGNMENTS,
} from "../lib/mockData";

async function seed() {
  console.log("Seeding...");

  // 1. Users (add placeholder email/passwordHash for existing mock users)
  await db.insert(schema.users).values(
    USERS.map((u) => ({
      ...u,
      email: `${u.id}@hireflow.local`,
      passwordHash: "$2a$10$placeholderplaceholderplaceholderplaceholderplaceholderpla",
    }))
  ).onConflictDoNothing();
  console.log("  users done");

  // 2. Vacancies (responsibleHrId references users)
  await db
    .insert(schema.vacancies)
    .values(
      VACANCIES.map((v) => ({
        id: v.id,
        title: v.title,
        department: v.department,
        workType: v.workType,
        employmentType: v.employmentType,
        location: v.location,
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        description: v.description,
        status: v.status,
        language: v.language,
        responsibleHrId: v.responsibleHrId,
        stageIds: v.stageIds,
        createdAt: new Date(v.createdAt),
        introMessage: v.introMessage ?? null,
        successMessage: v.successMessage ?? null,
      }))
    )
    .onConflictDoNothing();
  console.log("  vacancies done");

  // 3. Vacancy stages
  await db
    .insert(schema.vacancyStages)
    .values(
      STAGES.map((s) => ({
        id: s.id,
        vacancyId: s.vacancyId,
        name: s.name,
        color: s.color,
        isFinal: s.isFinal,
        isRejected: s.isRejected,
        orderIndex: s.orderIndex,
      }))
    )
    .onConflictDoNothing();
  console.log("  vacancy_stages done");

  // 4. Screening questions
  await db
    .insert(schema.screeningQuestions)
    .values(
      QUESTIONS.map((q) => ({
        id: q.id,
        vacancyId: q.vacancyId,
        text: q.text,
        type: q.type,
        options: q.options ?? null,
        orderIndex: q.orderIndex,
      }))
    )
    .onConflictDoNothing();
  console.log("  screening_questions done");

  // 5. Sources
  await db
    .insert(schema.sources)
    .values(
      SOURCES.map((s) => ({
        id: s.id,
        vacancyId: s.vacancyId,
        name: s.name,
        botLink: s.botLink,
      }))
    )
    .onConflictDoNothing();
  console.log("  sources done");

  // 6. Candidates
  await db
    .insert(schema.candidates)
    .values(
      CANDIDATES.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        telegramUsername: c.telegramUsername,
        telegramFirstName: c.telegramFirstName,
        telegramUserId: null,
        language: c.language,
        city: c.city,
        createdAt: new Date(c.createdAt),
      }))
    )
    .onConflictDoNothing();
  console.log("  candidates done");

  // 7. Applications
  await db
    .insert(schema.applications)
    .values(
      APPLICATIONS.map((a) => ({
        id: a.id,
        candidateId: a.candidateId,
        vacancyId: a.vacancyId,
        currentStageId: a.currentStageId,
        appliedAt: new Date(a.appliedAt),
        lastActivityAt: new Date(a.lastActivityAt),
        status: "submitted" as const,
      }))
    )
    .onConflictDoNothing();
  console.log("  applications done");

  // 8. Screening answers
  await db
    .insert(schema.screeningAnswers)
    .values(
      ANSWERS.map((a) => ({
        id: a.id,
        applicationId: a.applicationId,
        questionId: a.questionId,
        answerText: a.answerText,
        answeredAt: new Date(a.answeredAt),
      }))
    )
    .onConflictDoNothing();
  console.log("  screening_answers done");

  // 9. Timeline events
  await db
    .insert(schema.timelineEvents)
    .values(
      TIMELINE.map((t) => ({
        id: t.id,
        applicationId: t.applicationId,
        type: t.type,
        description: t.description,
        fromStageId: t.fromStageId ?? null,
        toStageId: t.toStageId ?? null,
        createdAt: new Date(t.createdAt),
      }))
    )
    .onConflictDoNothing();
  console.log("  timeline_events done");

  // 10. Telegram messages
  await db
    .insert(schema.telegramMessages)
    .values(
      MESSAGES.map((m) => ({
        id: m.id,
        candidateId: m.candidateId,
        applicationId: m.applicationId ?? null,
        direction: m.direction,
        senderType: m.senderType,
        senderName: m.senderName ?? null,
        text: m.text,
        sentAt: new Date(m.sentAt),
        readByUserIds: m.readByUserIds,
      }))
    )
    .onConflictDoNothing();
  console.log("  telegram_messages done");

  // 11. Internal notes
  await db
    .insert(schema.internalNotes)
    .values(
      NOTES.map((n) => ({
        id: n.id,
        applicationId: n.applicationId,
        userId: n.userId,
        text: n.text,
        createdAt: new Date(n.createdAt),
        isPinned: n.isPinned,
      }))
    )
    .onConflictDoNothing();
  console.log("  internal_notes done");

  // 12. Automation rules
  await db
    .insert(schema.automationRules)
    .values(
      AUTOMATION_RULES.map((r) => ({
        id: r.id,
        vacancyId: r.vacancyId,
        name: r.name,
        isEnabled: r.isEnabled,
        triggerType: r.triggerType,
        triggerStageId: r.triggerStageId ?? null,
        actionType: r.actionType,
        actionStageId: r.actionStageId ?? null,
        actionMessageText: r.actionMessageText ?? null,
        createdAt: new Date(r.createdAt),
      }))
    )
    .onConflictDoNothing();
  console.log("  automation_rules done");

  // 13. Test tasks
  await db
    .insert(schema.testTasks)
    .values(
      TEST_TASKS.map((t) => ({
        id: t.id,
        vacancyId: t.vacancyId,
        title: t.title,
        description: t.description,
        dueInDays: t.dueInDays,
      }))
    )
    .onConflictDoNothing();
  console.log("  test_tasks done");

  // 14. Test task assignments
  await db
    .insert(schema.testTaskAssignments)
    .values(
      TEST_TASK_ASSIGNMENTS.map((a) => ({
        id: a.id,
        taskId: a.taskId,
        applicationId: a.applicationId,
        assignedAt: new Date(a.assignedAt),
        dueAt: new Date(a.dueAt),
        status: a.status,
        submissionNote: a.submissionNote ?? null,
      }))
    )
    .onConflictDoNothing();
  console.log("  test_task_assignments done");

  console.log("Done.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
