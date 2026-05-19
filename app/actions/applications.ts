"use server";
import { db } from "@/lib/db/client";
import { applications, candidates, vacancyStages, timelineEvents, screeningAnswers, screeningQuestions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyCandidateOfStageChange } from "@/app/actions/bot";

export async function getApplicationsForVacancy(vacancyId: string, isDemo?: boolean) {
  return db
    .select({
      application: applications,
      candidate: candidates,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo ?? false)))
    .where(eq(applications.vacancyId, vacancyId));
}

export async function getApplicationFull(applicationId: string) {
  const rows = await db
    .select({
      application: applications,
      candidate: candidates,
    })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
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

  return { ...rows[0], answers: rawAnswers, timeline };
}

export async function moveApplicationToStage(applicationId: string, toStageId: string) {
  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId));
  const app = appRows[0];
  if (!app) return;

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
    createdAt: new Date(),
  });

  revalidatePath(`/vacancies/${app.vacancyId}`);
  revalidatePath(`/candidates/${applicationId}`);

  // Notify candidate via Telegram if they have a linked account
  await notifyCandidateOfStageChange(applicationId).catch((err) => {
    console.error("Stage notification failed:", err);
  });
}
