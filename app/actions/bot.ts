"use server";
import { db } from "@/lib/db/client";
import { candidates, applications, screeningAnswers, timelineEvents, botSessions, vacancyStages, vacancies, telegramMessages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createApplicationFromBot(args: {
  telegramUserId: string;
  telegramUsername?: string;
  telegramFirstName: string;
  fullName: string;
  vacancyId: string;
  answers: Record<string, string>;
  email?: string;
  notes?: string;
  cvFileId?: string;
  cvFilename?: string;
}) {
  // Upsert candidate
  const existing = await db
    .select()
    .from(candidates)
    .where(eq(candidates.telegramUserId, args.telegramUserId));

  let candidateId: string;
  if (existing[0]) {
    candidateId = existing[0].id;
    await db
      .update(candidates)
      .set({
        telegramUsername: args.telegramUsername ?? existing[0].telegramUsername,
        telegramFirstName: args.telegramFirstName,
        fullName: args.fullName,
        // Store email in phone field if provided and phone is empty
        ...(args.email && !existing[0].phone ? { phone: args.email } : {}),
      })
      .where(eq(candidates.id, candidateId));
  } else {
    candidateId = crypto.randomUUID();
    // isDemo: false — Telegram bot always writes to Live data, never Demo
    await db.insert(candidates).values({
      id: candidateId,
      fullName: args.fullName,
      telegramUserId: args.telegramUserId,
      telegramUsername: args.telegramUsername ?? "",
      telegramFirstName: args.telegramFirstName,
      phone: args.email ?? "",
      language: "en",
      city: "",
      isDemo: false,
      createdAt: new Date(),
    });
  }

  // Check for duplicate application
  const existingApp = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.candidateId, candidateId),
        eq(applications.vacancyId, args.vacancyId)
      )
    );
  if (existingApp[0]) return existingApp[0].id;

  // Get first stage
  const stages = await db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.vacancyId, args.vacancyId))
    .orderBy(asc(vacancyStages.orderIndex));
  const firstStage = stages[0];
  if (!firstStage) return null;

  // Create application
  const appId = crypto.randomUUID();
  await db.insert(applications).values({
    id: appId,
    candidateId,
    vacancyId: args.vacancyId,
    currentStageId: firstStage.id,
    appliedAt: new Date(),
    lastActivityAt: new Date(),
  });

  // Insert screening answers
  for (const [questionId, answerText] of Object.entries(args.answers)) {
    if (!answerText) continue; // skip blank/skipped answers
    await db.insert(screeningAnswers).values({
      id: crypto.randomUUID(),
      applicationId: appId,
      questionId,
      answerText,
      answeredAt: new Date(),
    });
  }

  // Timeline event — applied
  await db.insert(timelineEvents).values({
    id: crypto.randomUUID(),
    applicationId: appId,
    type: "applied",
    description: "Applied via Telegram bot",
    createdAt: new Date(),
  });

  // Timeline event — CV if provided
  if (args.cvFileId) {
    await db.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: appId,
      type: "answer_submitted",
      description: `CV attached: ${args.cvFilename ?? "cv.pdf"} (Telegram file_id: ${args.cvFileId})`,
      createdAt: new Date(),
    });
  }

  // Timeline event — notes if provided
  if (args.notes) {
    await db.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: appId,
      type: "answer_submitted",
      description: `Candidate note: ${args.notes}`,
      createdAt: new Date(),
    });
  }

  revalidatePath(`/vacancies/${args.vacancyId}`);
  return appId;
}

export async function upsertCandidateFromTelegram(args: {
  telegramUserId: string;
  telegramUsername?: string;
  telegramFirstName: string;
}): Promise<string> {
  const existing = await db
    .select()
    .from(candidates)
    .where(eq(candidates.telegramUserId, args.telegramUserId));

  if (existing[0]) {
    await db
      .update(candidates)
      .set({
        telegramUsername: args.telegramUsername ?? existing[0].telegramUsername,
        telegramFirstName: args.telegramFirstName,
      })
      .where(eq(candidates.id, existing[0].id));
    return existing[0].id;
  }

  const candidateId = crypto.randomUUID();
  // isDemo: false — Telegram bot always writes to Live data, never Demo
  await db.insert(candidates).values({
    id: candidateId,
    fullName: args.telegramFirstName,
    telegramUserId: args.telegramUserId,
    telegramUsername: args.telegramUsername ?? "",
    telegramFirstName: args.telegramFirstName,
    phone: "",
    language: "en",
    city: "",
    isDemo: false,
    createdAt: new Date(),
  });
  return candidateId;
}

export async function saveBotMessage(args: {
  candidateId: string;
  applicationId?: string | null;
  direction: "inbound" | "outbound";
  text: string;
  attachmentFileId?: string;
  attachmentType?: "photo" | "document";
  attachmentFilename?: string;
}): Promise<void> {
  await db.insert(telegramMessages).values({
    id: crypto.randomUUID(),
    candidateId: args.candidateId,
    applicationId: args.applicationId ?? null,
    direction: args.direction,
    senderType: args.direction === "inbound" ? "candidate" : "system",
    text: args.text,
    sentAt: new Date(),
    readByUserIds: [],
    attachmentFileId: args.attachmentFileId ?? null,
    attachmentType: args.attachmentType ?? null,
    attachmentFilename: args.attachmentFilename ?? null,
  });
}

export async function getOrCreateInProgressApplication(args: {
  candidateId: string;
  vacancyId: string;
}): Promise<string> {
  const existing = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.candidateId, args.candidateId),
        eq(applications.vacancyId, args.vacancyId)
      )
    );
  if (existing[0]) return existing[0].id;

  // Get Pre-screening stage (orderIndex 0)
  const stages = await db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.vacancyId, args.vacancyId))
    .orderBy(asc(vacancyStages.orderIndex));
  const preScreeningStage = stages[0];
  if (!preScreeningStage) throw new Error(`No stages found for vacancy ${args.vacancyId}`);

  const appId = crypto.randomUUID();
  await db.insert(applications).values({
    id: appId,
    candidateId: args.candidateId,
    vacancyId: args.vacancyId,
    currentStageId: preScreeningStage.id,
    appliedAt: new Date(),
    lastActivityAt: new Date(),
    status: "in_progress",
  });

  revalidatePath(`/vacancies/${args.vacancyId}`);
  return appId;
}

export async function saveScreeningAnswerLive(args: {
  applicationId: string;
  questionId: string;
  answerText: string;
}): Promise<void> {
  // Delete existing answer for this app+question, then insert fresh
  await db
    .delete(screeningAnswers)
    .where(
      and(
        eq(screeningAnswers.applicationId, args.applicationId),
        eq(screeningAnswers.questionId, args.questionId)
      )
    );
  await db.insert(screeningAnswers).values({
    id: crypto.randomUUID(),
    applicationId: args.applicationId,
    questionId: args.questionId,
    answerText: args.answerText,
    answeredAt: new Date(),
  });
}

export async function submitApplication(applicationId: string): Promise<void> {
  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId));
  const app = appRows[0];
  if (!app) return;

  // Find the stage after Pre-screening (orderIndex 1)
  const stages = await db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.vacancyId, app.vacancyId))
    .orderBy(asc(vacancyStages.orderIndex));

  const nextStage = stages.find((s) => s.orderIndex === 1) ?? stages[1];
  const targetStageId = nextStage ? nextStage.id : app.currentStageId;

  await db
    .update(applications)
    .set({ status: "submitted", currentStageId: targetStageId, lastActivityAt: new Date() })
    .where(eq(applications.id, applicationId));

  await db.insert(timelineEvents).values({
    id: crypto.randomUUID(),
    applicationId,
    type: "application_completed",
    description: "Application submitted via Telegram",
    createdAt: new Date(),
  });

  revalidatePath(`/vacancies/${app.vacancyId}`);
  revalidatePath(`/candidates/${applicationId}`);

  await notifyCandidateOfStageChange(applicationId).catch((err) => {
    console.error("Submit notification failed:", err);
  });
}

export async function finalizeApplicationDetails(args: {
  applicationId: string;
  fullName: string;
  email?: string;
  notes?: string;
  cvFileId?: string;
  cvFilename?: string;
}): Promise<void> {
  // Resolve candidateId from the application
  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, args.applicationId));
  const app = appRows[0];
  if (!app) return;

  // Update candidate's fullName; also store email in phone field if phone is blank
  const candRows = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, app.candidateId));
  const cand = candRows[0];
  if (!cand) return;

  const updateSet: Record<string, unknown> = { fullName: args.fullName };
  if (args.email && !cand.phone) {
    updateSet.phone = args.email;
  }
  await db.update(candidates).set(updateSet).where(eq(candidates.id, cand.id));

  // CV and notes go to timeline events
  if (args.cvFileId) {
    await db.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: args.applicationId,
      type: "answer_submitted",
      description: `CV attached: ${args.cvFilename ?? "cv.pdf"} (Telegram file_id: ${args.cvFileId})`,
      createdAt: new Date(),
    });
  }
  if (args.notes) {
    await db.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: args.applicationId,
      type: "answer_submitted",
      description: `Candidate note: ${args.notes}`,
      createdAt: new Date(),
    });
  }
}

export async function abandonApplication(applicationId: string): Promise<void> {
  await db
    .update(applications)
    .set({ status: "abandoned", lastActivityAt: new Date() })
    .where(eq(applications.id, applicationId));
}

export async function getBotSession(telegramUserId: string) {
  const rows = await db
    .select()
    .from(botSessions)
    .where(eq(botSessions.telegramUserId, telegramUserId));
  return rows[0] ?? null;
}

export async function saveBotSession(
  telegramUserId: string,
  data: Partial<Omit<typeof botSessions.$inferInsert, "telegramUserId">>
) {
  await db
    .insert(botSessions)
    .values({
      telegramUserId,
      state: data.state ?? "awaiting_name",
      ...data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: botSessions.telegramUserId,
      set: { ...data, updatedAt: new Date() },
    });
}

export async function clearBotSession(telegramUserId: string) {
  await db.delete(botSessions).where(eq(botSessions.telegramUserId, telegramUserId));
}

export async function notifyCandidateOfStageChange(applicationId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  // Get application + candidate + vacancy + stage
  const rows = await db
    .select({
      app: applications,
      cand: candidates,
      vac: vacancies,
    })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
    .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
    .where(eq(applications.id, applicationId));

  const row = rows[0];
  if (!row) return;

  const { cand, vac, app } = row;
  if (!cand.telegramUserId) return;

  const stageRows = await db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.id, app.currentStageId));
  const stage = stageRows[0];
  if (!stage) return;

  // Determine language from candidate's language field
  const lang = (cand.language === "ru" || cand.language === "uz")
    ? (cand.language as "ru" | "uz")
    : "en";

  const { notifyCandidateStageChange } = await import("@/lib/bot/handlers");
  await notifyCandidateStageChange(
    botToken,
    cand.telegramUserId,
    cand.fullName,
    vac.title,
    stage.name,
    stage.isRejected,
    lang
  );
}
