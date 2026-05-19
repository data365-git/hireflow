"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  applications,
  candidates,
  feedback,
  vacancies,
  vacancyStages,
} from "@/lib/db/schema";
import { getCurrentDataMode } from "@/lib/data-mode";
import { requirePermission } from "@/lib/auth/permissions";

export type FeedbackTarget = {
  applicationId: string;
  candidateName: string;
  vacancyId: string;
  vacancyTitle: string;
  stageName: string | null;
  status: string;
};

export type FeedbackItem = FeedbackTarget & {
  id: string;
  source: string;
  rating: number | null;
  comment: string | null;
  submittedAt: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function getFeedbackPageData(): Promise<{
  targets: FeedbackTarget[];
  items: FeedbackItem[];
}> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();

  const targets = await db
    .select({
      applicationId: applications.id,
      candidateName: candidates.fullName,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      stageName: vacancyStages.name,
      status: applications.status,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo)))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .orderBy(desc(applications.lastActivityAt));

  const items = await db
    .select({
      id: feedback.id,
      source: feedback.source,
      applicationId: applications.id,
      candidateName: candidates.fullName,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      stageName: vacancyStages.name,
      status: applications.status,
      rating: feedback.rating,
      comment: feedback.comment,
      submittedAt: feedback.submittedAt,
    })
    .from(feedback)
    .innerJoin(applications, eq(feedback.applicationId, applications.id))
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo)))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .orderBy(desc(feedback.submittedAt));

  return {
    targets,
    items: items.map((item) => ({
      ...item,
      submittedAt: item.submittedAt.toISOString(),
    })),
  };
}

export async function createHrFeedback(formData: FormData) {
  await requirePermission("candidates", "edit");
  const isDemo = await getCurrentDataMode();

  const applicationId = getString(formData, "applicationId");
  const comment = getString(formData, "comment");
  const ratingValue = getString(formData, "rating");

  if (!applicationId) throw new Error("Select an application before adding feedback.");
  if (!comment) throw new Error("Feedback note is required.");

  const rating = ratingValue === "" ? null : Number(ratingValue);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const [application] = await db
    .select({
      applicationId: applications.id,
      vacancyId: applications.vacancyId,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo)))
    .where(eq(applications.id, applicationId));

  if (!application) throw new Error("Application not found in the current data mode.");

  await db.insert(feedback).values({
    id: `fb-${crypto.randomUUID()}`,
    source: "hr",
    applicationId: application.applicationId,
    vacancyId: application.vacancyId,
    rating,
    comment,
  });

  revalidatePath("/feedback");
  revalidatePath(`/candidates/${application.applicationId}`);
  revalidatePath(`/vacancies/${application.vacancyId}`);
}
