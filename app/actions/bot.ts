"use server";
import { db } from "@/lib/db/client";
import { candidates, applications, screeningAnswers, timelineEvents, botSessions, vacancyStages, vacancies } from "@/lib/db/schema";
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
    await db.insert(candidates).values({
      id: candidateId,
      fullName: args.fullName,
      telegramUserId: args.telegramUserId,
      telegramUsername: args.telegramUsername ?? "",
      telegramFirstName: args.telegramFirstName,
      phone: args.email ?? "",
      language: "en",
      city: "",
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
