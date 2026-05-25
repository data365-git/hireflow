"use server";
import { db } from "@/lib/db/client";
import { vacancies, applications, vacancyStages, sources, timelineEvents, telegramMessages, candidates } from "@/lib/db/schema";
import { getCurrentDataMode } from "@/lib/data-mode";
import { requirePermission } from "@/lib/auth/permissions";
import { and, eq, inArray, isNull } from "drizzle-orm";

const vacancyNotDeleted = isNull(vacancies.deletedAt);

export type AnalyticsData = {
  vacancies: (typeof vacancies.$inferSelect)[];
  applications: (typeof applications.$inferSelect)[];
  stages: (typeof vacancyStages.$inferSelect)[];
  sources: (typeof sources.$inferSelect)[];
  timeline: (typeof timelineEvents.$inferSelect)[];
  messages: (typeof telegramMessages.$inferSelect)[];
};

export async function getAnalyticsData(): Promise<AnalyticsData> {
  await requirePermission("analytics", "read");
  const isDemo = await getCurrentDataMode();

  const allVacancies = await db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.isDemo, isDemo), vacancyNotDeleted));

  const vacancyIds = allVacancies.map((v) => v.id);

  if (vacancyIds.length === 0) {
    return { vacancies: allVacancies, applications: [], stages: [], sources: [], timeline: [], messages: [] };
  }

  const [allApps, allStages, allSources] = await Promise.all([
    db
      .select({
        id: applications.id,
        candidateId: applications.candidateId,
        vacancyId: applications.vacancyId,
        currentStageId: applications.currentStageId,
        appliedAt: applications.appliedAt,
        lastActivityAt: applications.lastActivityAt,
        status: applications.status,
        sourceId: applications.sourceId,
        motivationLetter: applications.motivationLetter,
        portfolioLinks: applications.portfolioLinks,
        applicationPhotoFileId: applications.applicationPhotoFileId,
      })
      .from(applications)
      .innerJoin(
        candidates,
        and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo))
      )
      .where(inArray(applications.vacancyId, vacancyIds)),
    db.select().from(vacancyStages).where(inArray(vacancyStages.vacancyId, vacancyIds)),
    db.select().from(sources).where(inArray(sources.vacancyId, vacancyIds)),
  ]);

  const appIds = allApps.map((a) => a.id);

  if (appIds.length === 0) {
    return { vacancies: allVacancies, applications: [], stages: allStages, sources: allSources, timeline: [], messages: [] };
  }

  const [allTimeline, allMessages] = await Promise.all([
    db.select().from(timelineEvents).where(inArray(timelineEvents.applicationId, appIds)),
    db.select().from(telegramMessages).where(inArray(telegramMessages.applicationId, appIds)),
  ]);

  return {
    vacancies: allVacancies,
    applications: allApps,
    stages: allStages,
    sources: allSources,
    timeline: allTimeline,
    messages: allMessages,
  };
}
