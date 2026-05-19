import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions, applications, candidates, telegramMessages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getBotSession, saveBotSession, clearBotSession, createApplicationFromBot, getOrCreateInProgressApplication, saveScreeningAnswerLive, submitApplication, abandonApplication, finalizeApplicationDetails } from "@/app/actions/bot";
import { detectLang, tr, type Lang } from "./i18n";

// ---- /start ----
export async function handleStart(ctx: Context) {
  const lang = detectLang(ctx);
  const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";

  if (!payload) {
    const kb = new InlineKeyboard()
      .text(tr(lang, "btn_browse_jobs"), "browse_jobs").row()
      .text(tr(lang, "btn_my_applications"), "my_applications").row()
      .text(tr(lang, "btn_help"), "help");
    await ctx.reply(
      `${tr(lang, "welcome_no_payload")}\n\n${tr(lang, "welcome_browse")}`,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
    return;
  }

  const vacancyId = payload.split("_")[0];
  await startVacancyFlow(ctx, vacancyId, lang);
}

async function startVacancyFlow(ctx: Context, vacancyId: string, lang: Lang) {
  const rows = await db.select().from(vacancies).where(eq(vacancies.id, vacancyId));
  const vacancy = rows[0];

  if (!vacancy || vacancy.status !== "active") {
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, vacancyId))
    .orderBy(asc(screeningQuestions.orderIndex));

  // +2 for name + email, +1 for CV, +1 for notes
  const totalSteps = 2 + questions.length + 2;
  const minutes = Math.max(2, Math.ceil(totalSteps * 0.5));

  const salaryText = vacancy.salaryMin > 0 && vacancy.salaryMax > 0
    ? `💰 $${vacancy.salaryMin.toLocaleString()}–$${vacancy.salaryMax.toLocaleString()}`
    : "";

  const header = [
    `📋 *${vacancy.title}*`,
    `🏢 ${vacancy.department}`,
    vacancy.location ? `📍 ${vacancy.location}` : "",
    salaryText,
    "",
    vacancy.description,
    "",
    tr(lang, "vacancy_intro", { minutes }),
  ].filter(Boolean).join("\n");

  const kb = new InlineKeyboard()
    .text(tr(lang, "btn_apply"), `apply_${vacancyId}`).row()
    .text(tr(lang, "btn_other_jobs"), "browse_jobs")
    .text(tr(lang, "btn_not_interested"), "not_interested");

  await ctx.reply(header, { reply_markup: kb, parse_mode: "Markdown" });
}

// ---- Callback queries ----
export async function handleCallbackQuery(ctx: Context) {
  const lang = detectLang(ctx);
  const data = ctx.callbackQuery?.data ?? "";
  await ctx.answerCallbackQuery();

  if (data.startsWith("apply_")) {
    const vacancyId = data.replace("apply_", "");
    const telegramUserId = String(ctx.from!.id);

    // Check for duplicate application
    const existingCand = await db.select().from(candidates)
      .where(eq(candidates.telegramUserId, telegramUserId));
    if (existingCand[0]) {
      const existingApp = await db.select().from(applications)
        .where(and(eq(applications.candidateId, existingCand[0].id), eq(applications.vacancyId, vacancyId)));
      if (existingApp[0]) {
        const vacRow = await db.select().from(vacancies).where(eq(vacancies.id, vacancyId));
        return ctx.reply(tr(lang, "already_applied", { vacancy: vacRow[0]?.title ?? vacancyId }), { parse_mode: "Markdown" });
      }
    }

    const questions = await db.select().from(screeningQuestions)
      .where(eq(screeningQuestions.vacancyId, vacancyId))
      .orderBy(asc(screeningQuestions.orderIndex));
    const totalSteps = 2 + questions.length + 2;

    // Create in_progress application immediately so the lead is visible
    const candidateId = (ctx as any).state?.candidateId as string | undefined;
    let applicationId: string | undefined;
    if (candidateId) {
      applicationId = await getOrCreateInProgressApplication({ candidateId, vacancyId });
    }

    await saveBotSession(telegramUserId, {
      vacancyId,
      applicationId: applicationId ?? null,
      state: "awaiting_name",
      currentQuestionIndex: 0,
      collectedData: { totalSteps },
    });

    await ctx.reply(tr(lang, "ask_name", { step: 1, total: totalSteps }), { parse_mode: "Markdown" });
    return;
  }

  if (data === "browse_jobs") return handleJobs(ctx);
  if (data === "my_applications") return handleStatus(ctx);
  if (data === "help") return handleHelp(ctx);
  if (data === "not_interested") {
    const session = await getBotSession(String(ctx.from!.id));
    if (session?.applicationId) {
      await abandonApplication(session.applicationId).catch((err) => {
        console.error("[handleCallbackQuery] abandonApplication failed:", err);
      });
    }
    await clearBotSession(String(ctx.from!.id));
    return ctx.reply(tr(lang, "cancelled"), { parse_mode: "Markdown" });
  }
  if (data === "submit_confirm") return handleSubmitConfirm(ctx, lang);
  if (data === "submit_cancel") {
    const session = await getBotSession(String(ctx.from!.id));
    if (session?.applicationId) {
      await abandonApplication(session.applicationId).catch((err) => {
        console.error("[handleCallbackQuery] abandonApplication (submit_cancel) failed:", err);
      });
    }
    await clearBotSession(String(ctx.from!.id));
    return ctx.reply(tr(lang, "cancelled"), { parse_mode: "Markdown" });
  }
}

// ---- /jobs ----
export async function handleJobs(ctx: Context) {
  const lang = detectLang(ctx);
  const activeVacancies = await db.select().from(vacancies).where(eq(vacancies.status, "active"));

  if (!activeVacancies.length) {
    return ctx.reply(tr(lang, "no_jobs"), { parse_mode: "Markdown" });
  }

  const kb = new InlineKeyboard();
  for (const v of activeVacancies) {
    const salary = v.salaryMin > 0 && v.salaryMax > 0
      ? ` · $${Math.round(v.salaryMin / 1000)}k–$${Math.round(v.salaryMax / 1000)}k`
      : "";
    kb.text(`${v.title}${salary}`, `apply_${v.id}`).row();
  }

  await ctx.reply(tr(lang, "jobs_header"), { reply_markup: kb, parse_mode: "Markdown" });
}

// ---- /status ----
export async function handleStatus(ctx: Context) {
  const lang = detectLang(ctx);
  const telegramUserId = String(ctx.from!.id);

  const candRows = await db.select().from(candidates)
    .where(eq(candidates.telegramUserId, telegramUserId));
  if (!candRows[0]) return ctx.reply(tr(lang, "no_applications"), { parse_mode: "Markdown" });

  const appRows = await db.select({
    app: applications,
    vacancy: vacancies,
    stage: vacancyStages,
  })
    .from(applications)
    .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .where(eq(applications.candidateId, candRows[0].id));

  if (!appRows.length) return ctx.reply(tr(lang, "no_applications"), { parse_mode: "Markdown" });

  const lines = [tr(lang, "status_header"), ""];
  for (let i = 0; i < appRows.length; i++) {
    const { app, vacancy: v, stage } = appRows[i];
    const date = app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—";
    lines.push(tr(lang, "status_item", {
      i: i + 1,
      vacancy: v.title,
      stage: stage?.name ?? "—",
      date,
    }));
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}

// ---- /help ----
export async function handleHelp(ctx: Context) {
  const lang = detectLang(ctx);
  await ctx.reply(tr(lang, "help_text"), { parse_mode: "Markdown" });
}

// ---- /cancel ----
export async function handleCancel(ctx: Context) {
  const lang = detectLang(ctx);
  const session = await getBotSession(String(ctx.from!.id));
  if (session?.applicationId) {
    await abandonApplication(session.applicationId).catch((err) => {
      console.error("[handleCancel] abandonApplication failed:", err);
    });
  }
  await clearBotSession(String(ctx.from!.id));
  await ctx.reply(tr(lang, "cancelled"), { parse_mode: "Markdown" });
}

// ---- Helper: find applicationId for a telegram user ----
async function getApplicationIdForUser(telegramUserId: string): Promise<string | null> {
  const result = await getApplicationAndCandidateForUser(telegramUserId);
  return result?.applicationId ?? null;
}

// ---- Helper: find both applicationId and candidateId for a telegram user ----
async function getApplicationAndCandidateForUser(telegramUserId: string): Promise<{ applicationId: string; candidateId: string } | null> {
  const candRows = await db
    .select()
    .from(candidates)
    .where(eq(candidates.telegramUserId, telegramUserId));
  if (!candRows[0]) return null;

  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.candidateId, candRows[0].id))
    .orderBy(applications.appliedAt);
  const latestApp = appRows[appRows.length - 1];
  if (!latestApp) return null;
  return { applicationId: latestApp.id, candidateId: candRows[0].id };
}

// ---- Handler for inbound photo messages (outside application flow) ----
export async function handlePhoto(ctx: Context) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);

  // If in an active flow state, ignore — flow handlers deal with documents but not photos
  if (session?.state && session.state !== "complete") {
    const lang = detectLang(ctx);
    return ctx.reply(tr(lang, "session_timeout"), { parse_mode: "Markdown" });
  }

  const photo = ctx.message?.photo?.at(-1);
  if (!photo) return;

  const ids = await getApplicationAndCandidateForUser(telegramUserId);
  if (!ids) return;

  await db.insert(telegramMessages).values({
    id: crypto.randomUUID(),
    candidateId: ids.candidateId,
    applicationId: ids.applicationId,
    direction: "inbound",
    senderType: "candidate",
    text: ctx.message?.caption ?? "",
    sentAt: new Date(),
    readByUserIds: [],
    attachmentFileId: photo.file_id,
    attachmentType: "photo",
  });
}

// ---- text/document messages during application flow ----
export async function handleText(ctx: Context) {
  const lang = detectLang(ctx);
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);

  if (!session?.state || session.state === "complete") {
    // No active flow — save inbound message to DB if we can resolve an application
    const doc = ctx.message?.document;
    const text = ctx.message?.text?.trim() ?? ctx.message?.caption ?? "";
    const ids = await getApplicationAndCandidateForUser(telegramUserId);

    if (ids) {
      await db.insert(telegramMessages).values({
        id: crypto.randomUUID(),
        candidateId: ids.candidateId,
        applicationId: ids.applicationId,
        direction: "inbound",
        senderType: "candidate",
        text: doc ? (ctx.message?.caption ?? "") : text,
        sentAt: new Date(),
        readByUserIds: [],
        ...(doc
          ? {
              attachmentFileId: doc.file_id,
              attachmentType: "document" as const,
              attachmentFilename: doc.file_name ?? undefined,
            }
          : {}),
      });
    }

    return ctx.reply(tr(lang, "session_timeout"), { parse_mode: "Markdown" });
  }

  const text = ctx.message?.text?.trim() ?? "";
  const data = (session.collectedData as Record<string, unknown>) ?? {};
  const totalSteps = (data.totalSteps as number) ?? 6;

  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, session.vacancyId!))
    .orderBy(asc(screeningQuestions.orderIndex));

  if (session.state === "awaiting_name") {
    if (!text) return ctx.reply(tr(lang, "ask_name", { step: 1, total: totalSteps }), { parse_mode: "Markdown" });
    data.fullName = text;
    await saveBotSession(telegramUserId, { state: "awaiting_email", collectedData: data });
    await ctx.reply(
      `${tr(lang, "got_name", { name: text })}\n\n${tr(lang, "ask_email", { step: 2, total: totalSteps })}`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (session.state === "awaiting_email") {
    if (!isValidEmail(text)) {
      return ctx.reply(tr(lang, "invalid_email"), { parse_mode: "Markdown" });
    }
    data.email = text;

    if (questions.length === 0) {
      const cvStep = 3;
      await saveBotSession(telegramUserId, { state: "awaiting_cv", collectedData: data });
      await ctx.reply(tr(lang, "ask_cv", { step: cvStep, total: totalSteps }), { parse_mode: "Markdown" });
    } else {
      await saveBotSession(telegramUserId, { state: "awaiting_question", currentQuestionIndex: 0, collectedData: data });
      await askQuestion(ctx, questions[0], 3, totalSteps, lang);
    }
    return;
  }

  if (session.state === "awaiting_question") {
    const qIdx = session.currentQuestionIndex ?? 0;
    const q = questions[qIdx];
    const answers = (data.answers as Record<string, string>) ?? {};

    const answerText = text === "/skip" ? "" : text;
    answers[q.id] = answerText;
    data.answers = answers;

    // Live-save answer to DB immediately
    const applicationId = (session as any).applicationId as string | undefined;
    if (applicationId && answerText) {
      await saveScreeningAnswerLive({ applicationId, questionId: q.id, answerText }).catch((err) => {
        console.error("[handleText] saveScreeningAnswerLive failed:", err);
      });
    }

    const nextIdx = qIdx + 1;
    if (nextIdx >= questions.length) {
      const cvStep = 3 + questions.length;
      await saveBotSession(telegramUserId, { state: "awaiting_cv", collectedData: data });
      await ctx.reply(
        `${tr(lang, "got_answer")}\n\n${tr(lang, "ask_cv", { step: cvStep, total: totalSteps })}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await saveBotSession(telegramUserId, { state: "awaiting_question", currentQuestionIndex: nextIdx, collectedData: data });
      await ctx.reply(tr(lang, "got_answer"), { parse_mode: "Markdown" });
      await askQuestion(ctx, questions[nextIdx], 3 + nextIdx, totalSteps, lang);
    }
    return;
  }

  if (session.state === "awaiting_cv") {
    const doc = ctx.message?.document;
    const notesStep = totalSteps - 1;

    if (doc) {
      data.cvFileId = doc.file_id;
      data.cvFilename = doc.file_name ?? "cv.pdf";
      await saveBotSession(telegramUserId, { state: "awaiting_notes", collectedData: data });
      await ctx.reply(
        `${tr(lang, "got_cv", { filename: doc.file_name ?? "cv.pdf" })}\n\n${tr(lang, "ask_notes", { step: notesStep, total: totalSteps })}`,
        { parse_mode: "Markdown" }
      );
    } else if (text === "/skip") {
      await saveBotSession(telegramUserId, { state: "awaiting_notes", collectedData: data });
      await ctx.reply(
        `${tr(lang, "skipped")}\n\n${tr(lang, "ask_notes", { step: notesStep, total: totalSteps })}`,
        { parse_mode: "Markdown" }
      );
    } else {
      return ctx.reply(tr(lang, "ask_cv", { step: totalSteps - 2, total: totalSteps }), { parse_mode: "Markdown" });
    }
    return;
  }

  if (session.state === "awaiting_notes") {
    if (text !== "/skip") {
      data.notes = text;
    }
    await saveBotSession(telegramUserId, { state: "awaiting_review", collectedData: data });
    await showReview(ctx, session.vacancyId!, data, lang);
    return;
  }
}

async function askQuestion(
  ctx: Context,
  q: { id: string; text: string; type: string; options: string[] | null | undefined },
  step: number,
  total: number,
  lang: Lang
) {
  const questionText = tr(lang, "ask_question", { step, total, question: q.text });

  if (q.type === "single-choice" && Array.isArray(q.options) && q.options.length > 0) {
    const kb = new InlineKeyboard();
    const opts = q.options;
    for (let i = 0; i < opts.length; i += 2) {
      if (opts[i + 1]) {
        kb.text(opts[i], `qans_${i}`).text(opts[i + 1], `qans_${i + 1}`).row();
      } else {
        kb.text(opts[i], `qans_${i}`).row();
      }
    }
    await ctx.reply(questionText, { reply_markup: kb, parse_mode: "Markdown" });
  } else {
    await ctx.reply(questionText, { parse_mode: "Markdown" });
  }
}

async function showReview(ctx: Context, vacancyId: string, data: Record<string, unknown>, lang: Lang) {
  const vacRow = await db.select().from(vacancies).where(eq(vacancies.id, vacancyId));
  const vacancy = vacRow[0];

  const lines = [
    tr(lang, "review_header"),
    tr(lang, "review_name", { value: String(data.fullName ?? "—") }),
    tr(lang, "review_email", { value: String(data.email ?? "—") }),
    tr(lang, "review_position", { value: vacancy?.title ?? vacancyId }),
    data.cvFileId ? tr(lang, "review_cv") : tr(lang, "review_no_cv"),
  ];

  if (data.notes) lines.push(`💬 Note: ${data.notes}`);

  const kb = new InlineKeyboard()
    .text(tr(lang, "btn_submit"), "submit_confirm").row()
    .text(tr(lang, "btn_cancel"), "submit_cancel");

  await ctx.reply(lines.join("\n"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function handleSubmitConfirm(ctx: Context, lang: Lang) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);
  if (!session) return ctx.reply(tr(lang, "error_generic"), { parse_mode: "Markdown" });

  const data = (session.collectedData as Record<string, unknown>) ?? {};

  try {
    let appId: string | null;
    const existingApplicationId = (session as any).applicationId as string | undefined;

    if (existingApplicationId) {
      // Phase 2A path: application already exists in_progress — finalize details then submit
      await finalizeApplicationDetails({
        applicationId: existingApplicationId,
        fullName: String(data.fullName ?? ctx.from!.first_name),
        email: data.email ? String(data.email) : undefined,
        notes: data.notes ? String(data.notes) : undefined,
        cvFileId: data.cvFileId ? String(data.cvFileId) : undefined,
        cvFilename: data.cvFilename ? String(data.cvFilename) : undefined,
      });
      await submitApplication(existingApplicationId);
      appId = existingApplicationId;
    } else {
      // Backward-compat path: no in_progress application (e.g. old session without applicationId)
      appId = await createApplicationFromBot({
        telegramUserId,
        telegramUsername: ctx.from!.username,
        telegramFirstName: ctx.from!.first_name,
        fullName: String(data.fullName ?? ctx.from!.first_name),
        email: data.email ? String(data.email) : undefined,
        notes: data.notes ? String(data.notes) : undefined,
        cvFileId: data.cvFileId ? String(data.cvFileId) : undefined,
        cvFilename: data.cvFilename ? String(data.cvFilename) : undefined,
        vacancyId: session.vacancyId!,
        answers: (data.answers as Record<string, string>) ?? {},
      });
    }

    await clearBotSession(telegramUserId);

    const vacRow = await db.select().from(vacancies).where(eq(vacancies.id, session.vacancyId!));

    const id = appId ?? "unknown";
    await ctx.reply(
      tr(lang, "submitted", {
        id: id.slice(0, 8).toUpperCase(),
        vacancy: vacRow[0]?.title ?? session.vacancyId!,
      }),
      { parse_mode: "Markdown" }
    );

    await notifyHR(ctx, id, vacRow[0]?.title ?? "", data);
  } catch (err) {
    console.error("Submit error:", err);
    await ctx.reply(tr(lang, "error_generic"), { parse_mode: "Markdown" });
  }
}

async function notifyHR(ctx: Context, appId: string, vacancyTitle: string, data: Record<string, unknown>) {
  const hrChatId = process.env.HR_NOTIFICATION_CHAT_ID;
  if (!hrChatId) return;

  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://hireflow-production-91a1.up.railway.app";
  const appUrl = `${baseUrl}/candidates/${appId}`;

  const text = [
    `🔔 *New application — ${vacancyTitle}*`,
    `👤 ${data.fullName ?? "—"} (@${ctx.from?.username ?? "no username"})`,
    `📧 ${data.email ?? "—"}`,
    data.cvFileId ? "📎 CV attached" : "📎 No CV",
    data.notes ? `💬 ${data.notes}` : "",
  ].filter(Boolean).join("\n");

  const kb = new InlineKeyboard().url("🔗 Open in HireFlow", appUrl);

  try {
    await ctx.api.sendMessage(hrChatId, text, { reply_markup: kb, parse_mode: "Markdown" });
  } catch (err) {
    console.error("HR notification failed:", err);
  }
}

// ---- Stage change notification (called from server action) ----
export async function notifyCandidateStageChange(
  botToken: string,
  telegramUserId: string,
  candidateName: string,
  vacancyTitle: string,
  stageName: string,
  isRejected: boolean,
  lang: Lang = "en"
) {
  const { Bot } = await import("grammy");
  const bot = new Bot(botToken);
  const key = isRejected ? "stage_rejected" : "stage_changed";
  const text = tr(lang, key, { name: candidateName, vacancy: vacancyTitle, stage: stageName });
  try {
    await bot.api.sendMessage(telegramUserId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Candidate notification failed:", err);
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
