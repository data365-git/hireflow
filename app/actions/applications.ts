"use server";
import { db } from "@/lib/db/client";
import { applications, candidates, vacancyStages, timelineEvents, screeningAnswers, screeningQuestions, vacancies, sources } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyCandidateOfStageChange } from "@/app/actions/bot";
import { getCurrentDataMode } from "@/lib/data-mode";
import { requirePermission } from "@/lib/auth/permissions";
import { fireStageEnteredAutomations } from "@/lib/automations/runner";

export type PipelineApplication = {
  id: string;
  candidateId: string;
  candidateName: string;
  vacancyId: string;
  vacancyTitle: string;
  currentStageId: string;
  stageColor: string;
  status: string;
  lastActivityAt: string;
  appliedAt: string;
  hasUnread: boolean;
  sourceName: string | null;
};

export async function getPipelineApplications(): Promise<PipelineApplication[]> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();

  const rows = await db
    .select({
      id: applications.id,
      candidateId: candidates.id,
      candidateName: candidates.fullName,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      currentStageId: applications.currentStageId,
      stageColor: vacancyStages.color,
      status: applications.status,
      lastActivityAt: applications.lastActivityAt,
      appliedAt: applications.appliedAt,
      sourceName: sources.name,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.status, "active")))
    .innerJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .leftJoin(sources, eq(applications.sourceId, sources.id))
    .orderBy(desc(applications.lastActivityAt));

  return rows.map((r) => ({
    ...r,
    hasUnread: false,
    sourceName: r.sourceName ?? null,
    lastActivityAt: r.lastActivityAt?.toISOString() ?? new Date().toISOString(),
    appliedAt: r.appliedAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function getApplicationsForVacancy(vacancyId: string) {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();
  const rows = await db
    .select({
      application: applications,
      candidate: candidates,
      sourceName: sources.name,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .leftJoin(sources, eq(applications.sourceId, sources.id))
    .where(eq(applications.vacancyId, vacancyId));

  const perCandidateVacancy = new Map<string, string[]>();
  const sortedById = [...rows].sort((a, b) =>
    (a.application.appliedAt?.getTime() ?? 0) - (b.application.appliedAt?.getTime() ?? 0)
  );
  for (const r of sortedById) {
    const key = `${r.application.candidateId}:${r.application.vacancyId}`;
    const arr = perCandidateVacancy.get(key) ?? [];
    arr.push(r.application.id);
    perCandidateVacancy.set(key, arr);
  }

  return rows.map((r) => {
    const key = `${r.application.candidateId}:${r.application.vacancyId}`;
    const arr = perCandidateVacancy.get(key) ?? [r.application.id];
    const rank = arr.indexOf(r.application.id) + 1;
    return {
      application: r.application,
      candidate: r.candidate,
      sourceName: r.sourceName ?? null,
      applicationRank: rank,
    };
  });
}

export async function getApplicationFull(applicationId: string) {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();
  const rows = await db
    .select({
      application: applications,
      candidate: candidates,
      sourceName: sources.name,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .leftJoin(sources, eq(applications.sourceId, sources.id))
    .where(eq(applications.id, applicationId));

  if (!rows[0]) return null;

  const rawAnswers = await db
    .select({
      answer: screeningAnswers,
      question: screeningQuestions,
    })
    .from(screeningAnswers)
    .innerJoin(screeningQuestions, eq(screeningAnswers.questionId, screeningQuestions.id))
    .where(eq(screeningAnswers.applicationId, applicationId));

  const timeline = await db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.applicationId, applicationId))
    .orderBy(timelineEvents.createdAt);

  return { ...rows[0], sourceName: rows[0].sourceName ?? null, answers: rawAnswers, timeline };
}

export type UnifiedApplication = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidatePhone: string | null;
  vacancyId: string;
  vacancyTitle: string;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  status: string;
  hasUnread: boolean;
  appliedAt: string;
  lastActivityAt: string;
  sourceName: string | null;
};

export async function getAllPipelineApplications(): Promise<UnifiedApplication[]> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();

  const rows = await db
    .select({
      id: applications.id,
      candidateId: candidates.id,
      candidateName: candidates.fullName,
      candidatePhone: candidates.phone,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      stageId: vacancyStages.id,
      stageName: vacancyStages.name,
      stageColor: vacancyStages.color,
      status: applications.status,
      lastActivityAt: applications.lastActivityAt,
      appliedAt: applications.appliedAt,
      sourceName: sources.name,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo)))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .leftJoin(sources, eq(applications.sourceId, sources.id))
    .orderBy(desc(applications.lastActivityAt));

  return rows.map((r) => ({
    ...r,
    candidatePhone: r.candidatePhone ?? null,
    stageId: r.stageId ?? null,
    stageName: r.stageName ?? null,
    stageColor: r.stageColor ?? null,
    hasUnread: false,
    sourceName: r.sourceName ?? null,
    lastActivityAt: r.lastActivityAt?.toISOString() ?? new Date().toISOString(),
    appliedAt: r.appliedAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function moveApplicationToStage(applicationId: string, toStageId: string, comment?: string, automationDepth = 0) {
  if (automationDepth === 0) {
    await requirePermission("candidates", "edit");
  }
  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId));
  const app = appRows[0];
  if (!app) return;
  if (app.currentStageId === toStageId) return;

  const stageRows = await db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.id, toStageId));
  const toStage = stageRows[0];
  if (!toStage || toStage.vacancyId !== app.vacancyId) return;

  await db
    .update(applications)
    .set({ currentStageId: toStageId, lastActivityAt: new Date() })
    .where(eq(applications.id, applicationId));

  await db.insert(timelineEvents).values({
    id: crypto.randomUUID(),
    applicationId,
    type: "stage_changed",
    description: `Moved to ${toStage.name}`,
    fromStageId: app.currentStageId,
    toStageId,
    comment: comment?.trim() || null,
    createdAt: new Date(),
  });

  revalidatePath(`/vacancies/${app.vacancyId}`);
  revalidatePath(`/candidates/${applicationId}`);

  // Notify candidate via Telegram if they have a linked account
  await notifyCandidateOfStageChange(applicationId).catch((err) => {
    console.error("Stage notification failed:", err);
  });

  await fireStageEnteredAutomations(applicationId, toStageId, automationDepth).catch((err) => {
    console.error("Stage automation failed:", err);
  });
}

export async function listAllSourceNames(): Promise<string[]> {
  await requirePermission("candidates", "read");
  const rows = await db
    .selectDistinct({ name: sources.name })
    .from(sources)
    .where(eq(sources.isArchived, false));
  return rows.map((r) => r.name).filter(Boolean).sort();
}
