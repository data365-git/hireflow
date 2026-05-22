"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
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

const vacancyNotDeleted = isNull(vacancies.deletedAt);
const FEEDBACK_STATUSES = ["new", "in_review", "responded", "resolved"] as const;
export type FeedbackStatus = "new" | "in_review" | "responded" | "resolved";

export type FeedbackTarget = {
  applicationId: string;
  candidateName: string;
  vacancyId: string;
  vacancyTitle: string;
  stageName: string | null;
  status: string;
};

export type FeedbackItem = {
  id: string;
  source: string;
  kind: string;
  status: FeedbackStatus;
  applicationId: string | null;
  candidateName: string;
  vacancyId: string | null;
  vacancyTitle: string | null;
  applicationStageName: string | null;
  applicationStatus: string | null;
  rating: number | null;
  comment: string | null;
  replyText: string | null;
  replyLink: string | null;
  submittedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseKind(value: string) {
  return value === "complaint" || value === "suggestion" ? value : null;
}

function parseStatus(value: string): FeedbackStatus | null {
  return FEEDBACK_STATUSES.includes(value as FeedbackStatus) ? (value as FeedbackStatus) : null;
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
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .orderBy(desc(applications.lastActivityAt));

  const items = await db
    .select({
      id: feedback.id,
      source: feedback.source,
      kind: feedback.kind,
      status: feedback.status,
      applicationId: applications.id,
      candidateName: candidates.fullName,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      applicationStageName: vacancyStages.name,
      applicationStatus: applications.status,
      rating: feedback.rating,
      comment: feedback.comment,
      replyText: feedback.replyText,
      replyLink: feedback.replyLink,
      submittedAt: feedback.submittedAt,
      respondedAt: feedback.respondedAt,
      resolvedAt: feedback.resolvedAt,
      updatedAt: feedback.updatedAt,
    })
    .from(feedback)
    .leftJoin(applications, eq(feedback.applicationId, applications.id))
    .innerJoin(
      candidates,
      and(
        or(eq(feedback.candidateId, candidates.id), eq(applications.candidateId, candidates.id)),
        eq(candidates.isDemo, isDemo),
      ),
    )
    .leftJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo)))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .where(and(inArray(feedback.kind, ["complaint", "suggestion"]), or(isNull(applications.id), vacancyNotDeleted)))
    .orderBy(desc(feedback.submittedAt));

  return {
    targets,
    items: items.map((item) => ({
      ...item,
      status: parseStatus(item.status) ?? "new",
      submittedAt: item.submittedAt.toISOString(),
      respondedAt: item.respondedAt?.toISOString() ?? null,
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export async function createHrFeedback(formData: FormData) {
  await requirePermission("candidates", "edit");
  const isDemo = await getCurrentDataMode();

  const applicationId = getString(formData, "applicationId");
  const kind = parseKind(getString(formData, "kind"));
  const comment = getString(formData, "comment");
  const ratingValue = getString(formData, "rating");

  if (!applicationId) throw new Error("Select an application before adding feedback.");
  if (!kind) throw new Error("Choose complaint or suggestion.");
  if (!comment) throw new Error("Feedback note is required.");

  const rating = ratingValue === "" ? null : Number(ratingValue);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const [application] = await db
    .select({
      applicationId: applications.id,
      candidateId: applications.candidateId,
      vacancyId: applications.vacancyId,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .where(eq(applications.id, applicationId));

  if (!application) throw new Error("Application not found in the current data mode.");

  await db.insert(feedback).values({
    id: `fb-${crypto.randomUUID()}`,
    source: "hr",
    kind,
    status: "new",
    candidateId: application.candidateId,
    applicationId: application.applicationId,
    vacancyId: application.vacancyId,
    rating,
    comment,
    updatedAt: new Date(),
  });

  revalidatePath("/feedback");
  revalidatePath(`/candidates/${application.applicationId}`);
  revalidatePath(`/vacancies/${application.vacancyId}`);
}

export async function updateFeedbackStatus(formData: FormData) {
  await requirePermission("candidates", "edit");

  const id = getString(formData, "id");
  const status = parseStatus(getString(formData, "status"));
  if (!id) throw new Error("Feedback item is required.");
  if (!status) throw new Error("Choose a valid feedback stage.");

  const now = new Date();
  const [item] = await db
    .select({
      id: feedback.id,
      applicationId: feedback.applicationId,
      vacancyId: feedback.vacancyId,
    })
    .from(feedback)
    .where(eq(feedback.id, id));

  if (!item) throw new Error("Feedback item not found.");

  await db
    .update(feedback)
    .set({
      status,
      respondedAt: status === "responded" || status === "resolved" ? now : null,
      resolvedAt: status === "resolved" ? now : null,
      updatedAt: now,
    })
    .where(eq(feedback.id, id));

  revalidatePath("/feedback");
  if (item.applicationId) revalidatePath(`/candidates/${item.applicationId}`);
  if (item.vacancyId) revalidatePath(`/vacancies/${item.vacancyId}`);
}

export async function saveFeedbackReply(formData: FormData) {
  await requirePermission("candidates", "edit");

  const id = getString(formData, "id");
  const replyText = getString(formData, "replyText");
  const replyLink = getString(formData, "replyLink");
  if (!id) throw new Error("Feedback item is required.");
  if (!replyText) throw new Error("Reply text is required.");

  const now = new Date();
  const [item] = await db
    .select({
      id: feedback.id,
      applicationId: feedback.applicationId,
      vacancyId: feedback.vacancyId,
    })
    .from(feedback)
    .where(eq(feedback.id, id));

  if (!item) throw new Error("Feedback item not found.");

  await db
    .update(feedback)
    .set({
      replyText,
      replyLink: replyLink || null,
      status: "responded",
      respondedAt: now,
      updatedAt: now,
    })
    .where(eq(feedback.id, id));

  revalidatePath("/feedback");
  if (item.applicationId) revalidatePath(`/candidates/${item.applicationId}`);
  if (item.vacancyId) revalidatePath(`/vacancies/${item.vacancyId}`);
}
