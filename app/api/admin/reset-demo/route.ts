export const runtime = "nodejs";

import { db } from "@/lib/db/client";
import {
  screeningAnswers,
  timelineEvents,
  internalNotes,
  testTaskAssignments,
  telegramMessages,
  applications,
  screeningQuestions,
  vacancyStages,
  vacancies,
  candidates,
  sources,
  automationRules,
  testTasks,
} from "@/lib/db/schema";
import { inArray, or } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse } from "@/lib/auth/session";
import {
  VACANCIES,
  STAGES,
  QUESTIONS,
  SOURCES,
  CANDIDATES,
  APPLICATIONS,
  ANSWERS,
  TIMELINE,
  MESSAGES,
  NOTES,
  AUTOMATION_RULES,
  TEST_TASKS,
  TEST_TASK_ASSIGNMENTS,
} from "@/lib/mockData";

export async function POST(_req: Request) {
  try {
    await requirePermission("settings", "write");

    // ── 1. Collect demo IDs ──────────────────────────────────────────────────
    const demoVacancyIds = VACANCIES.map((v) => v.id);
    const demoCandidateIds = CANDIDATES.map((c) => c.id);

    // ── 2. Delete children first (FK order) ─────────────────────────────────

    // screeningAnswers → applicationId in demo applications
    const demoAppIds = APPLICATIONS.map((a) => a.id);
    if (demoAppIds.length > 0) {
      await db
        .delete(screeningAnswers)
        .where(inArray(screeningAnswers.applicationId, demoAppIds));

      await db
        .delete(timelineEvents)
        .where(inArray(timelineEvents.applicationId, demoAppIds));

      await db
        .delete(internalNotes)
        .where(inArray(internalNotes.applicationId, demoAppIds));

      await db
        .delete(testTaskAssignments)
        .where(inArray(testTaskAssignments.applicationId, demoAppIds));
    }

    // telegramMessages → candidateId in demo candidates
    if (demoCandidateIds.length > 0) {
      await db
        .delete(telegramMessages)
        .where(inArray(telegramMessages.candidateId, demoCandidateIds));
    }

    // applications → vacancyId or candidateId is demo
    if (demoVacancyIds.length > 0 || demoCandidateIds.length > 0) {
      await db.delete(applications).where(
        or(
          inArray(applications.vacancyId, demoVacancyIds),
          inArray(applications.candidateId, demoCandidateIds)
        )
      );
    }

    // screeningQuestions, vacancyStages, sources, automationRules, testTasks → vacancyId
    if (demoVacancyIds.length > 0) {
      await db
        .delete(screeningQuestions)
        .where(inArray(screeningQuestions.vacancyId, demoVacancyIds));

      await db
        .delete(vacancyStages)
        .where(inArray(vacancyStages.vacancyId, demoVacancyIds));

      await db
        .delete(sources)
        .where(inArray(sources.vacancyId, demoVacancyIds));

      await db
        .delete(automationRules)
        .where(inArray(automationRules.vacancyId, demoVacancyIds));

      await db
        .delete(testTasks)
        .where(inArray(testTasks.vacancyId, demoVacancyIds));
    }

    // vacancies and candidates
    if (demoVacancyIds.length > 0) {
      await db
        .delete(vacancies)
        .where(inArray(vacancies.id, demoVacancyIds));
    }

    if (demoCandidateIds.length > 0) {
      await db
        .delete(candidates)
        .where(inArray(candidates.id, demoCandidateIds));
    }

    // ── 3. Re-seed demo data ─────────────────────────────────────────────────

    await db
      .insert(vacancies)
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
          isDemo: true,
        }))
      )
      .onConflictDoNothing();

    await db
      .insert(vacancyStages)
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

    await db
      .insert(screeningQuestions)
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

    if (SOURCES.length > 0) {
      await db
        .insert(sources)
        .values(
          SOURCES.map((s) => ({
            id: s.id,
            vacancyId: s.vacancyId,
            name: s.name,
            botLink: s.botLink,
          }))
        )
        .onConflictDoNothing();
    }

    await db
      .insert(candidates)
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
          isDemo: true,
        }))
      )
      .onConflictDoNothing();

    await db
      .insert(applications)
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

    await db
      .insert(screeningAnswers)
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

    await db
      .insert(timelineEvents)
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

    await db
      .insert(telegramMessages)
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

    await db
      .insert(internalNotes)
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

    if (AUTOMATION_RULES.length > 0) {
      await db
        .insert(automationRules)
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
    }

    if (TEST_TASKS.length > 0) {
      await db
        .insert(testTasks)
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
    }

    if (TEST_TASK_ASSIGNMENTS.length > 0) {
      await db
        .insert(testTaskAssignments)
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
    }

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
