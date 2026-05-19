export const runtime = "nodejs";

import { db } from "@/lib/db/client";
import {
  applicationWatches,
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
  candidateRelationships,
  candidateBlacklist,
  feedback,
  botSessions,
} from "@/lib/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
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

    const summary = await db.transaction(async (tx) => {
      const existingDemoVacancies = await tx
        .select({ id: vacancies.id })
        .from(vacancies)
        .where(eq(vacancies.isDemo, true));
      const existingDemoCandidates = await tx
        .select({ id: candidates.id })
        .from(candidates)
        .where(eq(candidates.isDemo, true));

      const demoVacancyIds = existingDemoVacancies.map((v) => v.id);
      const demoCandidateIds = existingDemoCandidates.map((c) => c.id);

      const demoAppIdSet = new Set<string>();
      if (demoVacancyIds.length > 0) {
        const rows = await tx
          .select({ id: applications.id })
          .from(applications)
          .where(inArray(applications.vacancyId, demoVacancyIds));
        rows.forEach((row) => demoAppIdSet.add(row.id));
      }
      if (demoCandidateIds.length > 0) {
        const rows = await tx
          .select({ id: applications.id })
          .from(applications)
          .where(inArray(applications.candidateId, demoCandidateIds));
        rows.forEach((row) => demoAppIdSet.add(row.id));
      }
      const demoAppIds = Array.from(demoAppIdSet);

      const demoTaskIds =
        demoVacancyIds.length > 0
          ? (
              await tx
                .select({ id: testTasks.id })
                .from(testTasks)
                .where(inArray(testTasks.vacancyId, demoVacancyIds))
            ).map((row) => row.id)
          : [];

      if (demoAppIds.length > 0) {
        await tx.delete(screeningAnswers).where(inArray(screeningAnswers.applicationId, demoAppIds));
        await tx.delete(timelineEvents).where(inArray(timelineEvents.applicationId, demoAppIds));
        await tx.delete(internalNotes).where(inArray(internalNotes.applicationId, demoAppIds));
        await tx.delete(applicationWatches).where(inArray(applicationWatches.applicationId, demoAppIds));
        await tx.delete(feedback).where(inArray(feedback.applicationId, demoAppIds));
        await tx.delete(telegramMessages).where(inArray(telegramMessages.applicationId, demoAppIds));
        await tx.delete(testTaskAssignments).where(inArray(testTaskAssignments.applicationId, demoAppIds));
        await tx.delete(botSessions).where(inArray(botSessions.applicationId, demoAppIds));
      }

      if (demoTaskIds.length > 0) {
        await tx.delete(testTaskAssignments).where(inArray(testTaskAssignments.taskId, demoTaskIds));
      }

      if (demoCandidateIds.length > 0) {
        await tx
          .delete(candidateRelationships)
          .where(
            or(
              inArray(candidateRelationships.candidateAId, demoCandidateIds),
              inArray(candidateRelationships.candidateBId, demoCandidateIds)
            )
          );
        await tx.delete(candidateBlacklist).where(inArray(candidateBlacklist.candidateId, demoCandidateIds));
        await tx.delete(telegramMessages).where(inArray(telegramMessages.candidateId, demoCandidateIds));
      }

      if (demoVacancyIds.length > 0) {
        await tx.delete(feedback).where(inArray(feedback.vacancyId, demoVacancyIds));
        await tx.delete(botSessions).where(inArray(botSessions.vacancyId, demoVacancyIds));
        await tx.delete(automationRules).where(inArray(automationRules.vacancyId, demoVacancyIds));
        await tx.delete(sources).where(inArray(sources.vacancyId, demoVacancyIds));
        await tx.delete(screeningQuestions).where(inArray(screeningQuestions.vacancyId, demoVacancyIds));
      }

      if (demoAppIds.length > 0) {
        await tx.delete(applications).where(inArray(applications.id, demoAppIds));
      }

      if (demoVacancyIds.length > 0) {
        await tx.delete(testTasks).where(inArray(testTasks.vacancyId, demoVacancyIds));
        await tx.delete(vacancyStages).where(inArray(vacancyStages.vacancyId, demoVacancyIds));
      }

      await tx.delete(vacancies).where(eq(vacancies.isDemo, true));
      await tx.delete(candidates).where(eq(candidates.isDemo, true));

      // ── Re-seed demo data ──────────────────────────────────────────────────

      await tx
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

      const seededVacancyIds = new Set(
        (
          await tx
            .select({ id: vacancies.id })
            .from(vacancies)
            .where(and(inArray(vacancies.id, VACANCIES.map((v) => v.id)), eq(vacancies.isDemo, true)))
        )
          .map((row) => row.id)
      );
      const seededVacancyIdList = Array.from(seededVacancyIds);

      const seedStages = STAGES.filter((s) => seededVacancyIds.has(s.vacancyId));
      if (seedStages.length > 0) {
        await tx
          .insert(vacancyStages)
          .values(
            seedStages.map((s) => ({
              id: s.id,
              vacancyId: s.vacancyId,
              name: s.name,
              color: s.color,
              isFinal: s.isFinal,
              isRejected: s.isRejected,
              isReserve: s.isReserve ?? false,
              orderIndex: s.orderIndex,
            }))
          )
          .onConflictDoNothing();
      }

      const seedQuestions = QUESTIONS.filter((q) => seededVacancyIds.has(q.vacancyId));
      if (seedQuestions.length > 0) {
        await tx
          .insert(screeningQuestions)
          .values(
            seedQuestions.map((q) => ({
              id: q.id,
              vacancyId: q.vacancyId,
              text: q.text,
              type: q.type,
              options: q.options ?? null,
              orderIndex: q.orderIndex,
            }))
          )
          .onConflictDoNothing();
      }

      const seedSources = SOURCES.filter((s) => seededVacancyIds.has(s.vacancyId));
      if (seedSources.length > 0) {
        await tx
        .insert(sources)
        .values(
          seedSources.map((s) => ({
            id: s.id,
            vacancyId: s.vacancyId,
            name: s.name,
            botLink: s.botLink,
          }))
        )
        .onConflictDoNothing();
      }

      await tx
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

      const seededCandidateIds = new Set(
        (
          await tx
            .select({ id: candidates.id })
            .from(candidates)
            .where(and(inArray(candidates.id, CANDIDATES.map((c) => c.id)), eq(candidates.isDemo, true)))
        )
          .map((row) => row.id)
      );
      const seededCandidateIdList = Array.from(seededCandidateIds);

      const seededStageIds = new Set(
        seedStages.length > 0
          ? (
              await tx
                .select({ id: vacancyStages.id })
                .from(vacancyStages)
                .where(
                  and(
                    inArray(vacancyStages.id, seedStages.map((s) => s.id)),
                    inArray(vacancyStages.vacancyId, seededVacancyIdList)
                  )
                )
            ).map((row) => row.id)
          : []
      );
      const seededStageIdList = Array.from(seededStageIds);

      const seedApplications = APPLICATIONS.filter(
        (a) =>
          seededVacancyIds.has(a.vacancyId) &&
          seededCandidateIds.has(a.candidateId) &&
          seededStageIds.has(a.currentStageId)
      );

      if (seedApplications.length > 0) {
        await tx
          .insert(applications)
          .values(
            seedApplications.map((a) => ({
              id: a.id,
              candidateId: a.candidateId,
              vacancyId: a.vacancyId,
              currentStageId: a.currentStageId,
              appliedAt: new Date(a.appliedAt),
              lastActivityAt: new Date(a.lastActivityAt),
              status: a.status,
            }))
          )
          .onConflictDoNothing();
      }

      const seededAppIds = new Set(
        seedApplications.length > 0
          ? (
              await tx
                .select({ id: applications.id })
                .from(applications)
                .where(
                  and(
                    inArray(applications.id, seedApplications.map((a) => a.id)),
                    inArray(applications.vacancyId, seededVacancyIdList),
                    inArray(applications.candidateId, seededCandidateIdList),
                    inArray(applications.currentStageId, seededStageIdList)
                  )
                )
            ).map((row) => row.id)
          : []
      );

      const seededQuestionIds = new Set(
        seedQuestions.length > 0
          ? (
              await tx
                .select({ id: screeningQuestions.id })
                .from(screeningQuestions)
                .where(
                  and(
                    inArray(screeningQuestions.id, seedQuestions.map((q) => q.id)),
                    inArray(screeningQuestions.vacancyId, seededVacancyIdList)
                  )
                )
            ).map((row) => row.id)
          : []
      );

      const seedAnswers = ANSWERS.filter(
        (a) => seededAppIds.has(a.applicationId) && seededQuestionIds.has(a.questionId)
      );
      if (seedAnswers.length > 0) {
        await tx
          .insert(screeningAnswers)
          .values(
            seedAnswers.map((a) => ({
              id: a.id,
              applicationId: a.applicationId,
              questionId: a.questionId,
              answerText: a.answerText,
              answeredAt: new Date(a.answeredAt),
            }))
          )
          .onConflictDoNothing();
      }

      const seedTimeline = TIMELINE.filter((t) => seededAppIds.has(t.applicationId));
      if (seedTimeline.length > 0) {
        await tx
          .insert(timelineEvents)
          .values(
            seedTimeline.map((t) => ({
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
      }

      const seedMessages = MESSAGES.filter(
        (m) =>
          seededCandidateIds.has(m.candidateId) &&
          (m.applicationId == null || seededAppIds.has(m.applicationId))
      );
      if (seedMessages.length > 0) {
        await tx
          .insert(telegramMessages)
          .values(
            seedMessages.map((m) => ({
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
      }

      const seedNotes = NOTES.filter((n) => seededAppIds.has(n.applicationId));
      if (seedNotes.length > 0) {
        await tx
          .insert(internalNotes)
          .values(
            seedNotes.map((n) => ({
              id: n.id,
              applicationId: n.applicationId,
              userId: n.userId,
              text: n.text,
              createdAt: new Date(n.createdAt),
              isPinned: n.isPinned,
            }))
          )
          .onConflictDoNothing();
      }

      const seedAutomationRules = AUTOMATION_RULES.filter((r) => seededVacancyIds.has(r.vacancyId));
      if (seedAutomationRules.length > 0) {
        await tx
        .insert(automationRules)
        .values(
          seedAutomationRules.map((r) => ({
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

      const seedTestTasks = TEST_TASKS.filter((t) => seededVacancyIds.has(t.vacancyId));
      if (seedTestTasks.length > 0) {
        await tx
        .insert(testTasks)
        .values(
          seedTestTasks.map((t) => ({
            id: t.id,
            vacancyId: t.vacancyId,
            title: t.title,
            description: t.description,
            dueInDays: t.dueInDays,
          }))
        )
        .onConflictDoNothing();
      }

      const seededTaskIds = new Set(
        seedTestTasks.length > 0
          ? (
              await tx
                .select({ id: testTasks.id })
                .from(testTasks)
                .where(
                  and(
                    inArray(testTasks.id, seedTestTasks.map((t) => t.id)),
                    inArray(testTasks.vacancyId, seededVacancyIdList)
                  )
                )
            ).map((row) => row.id)
          : []
      );

      const seedTaskAssignments = TEST_TASK_ASSIGNMENTS.filter(
        (a) => seededTaskIds.has(a.taskId) && seededAppIds.has(a.applicationId)
      );
      if (seedTaskAssignments.length > 0) {
        await tx
        .insert(testTaskAssignments)
        .values(
          seedTaskAssignments.map((a) => ({
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

      return {
        deleted: {
          vacancies: demoVacancyIds.length,
          candidates: demoCandidateIds.length,
          applications: demoAppIds.length,
        },
        seeded: {
          vacancies: seededVacancyIds.size,
          candidates: seededCandidateIds.size,
          applications: seededAppIds.size,
        },
      };
    });

    return Response.json({ ok: true, ...summary });
  } catch (err) {
    return toResponse(err);
  }
}
