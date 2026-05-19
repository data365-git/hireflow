import { InlineKeyboard, Keyboard } from "grammy";
import type { Context } from "grammy";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions, applications, candidates, departments } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getBotSession, saveBotSession, clearBotSession, createApplicationFromBot, getOrCreateBrowsingApplication, getOrCreateInProgressApplication, ensureApplicationInProgress, saveScreeningAnswerLive, submitApplication, abandonApplication, finalizeApplicationDetails } from "@/app/actions/bot";
import { detectLang, tr, type Lang } from "./i18n";

async function getLiveActiveVacancy(vacancyId: string) {
  const rows = await db.select().from(vacancies).where(and(eq(vacancies.id, vacancyId), eq(vacancies.isDemo, false)));
  const vacancy = rows[0];
  return vacancy?.status === "active" ? vacancy : null;
}

const ANKETA_STATES = new Set([
  "awaiting_lang_pref",
  "awaiting_department",
  "awaiting_full_name",
  "awaiting_dob",
  "awaiting_address",
  "awaiting_phone",
  "awaiting_marital_status",
  "awaiting_student_status",
  "awaiting_education_field",
  "awaiting_english_level",
  "awaiting_russian_level",
  "awaiting_work_company",
  "awaiting_work_position",
  "awaiting_work_period",
  "awaiting_work_leave_reason",
]);

type WorkExperienceDraft = {
  company?: string;
  position?: string;
  period?: string;
  leaveReason?: string;
};

function normalizeDepartmentName(value: string): string {
  return value.trim().toLowerCase();
}

function departmentIdForName(value: string): string {
  const slug = normalizeDepartmentName(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `dept_${slug || "general"}`;
}

async function getBotVisibleDepartments() {
  const vacancyRows = await db
    .select({
      department: vacancies.department,
    })
    .from(vacancies)
    .where(and(eq(vacancies.status, "active"), eq(vacancies.isDemo, false)))
    .orderBy(asc(vacancies.department));

  const byName = new Map<string, { id: string; name: string; displayName: string }>();
  for (const vacancy of vacancyRows) {
    const displayName = vacancy.department.trim();
    const name = normalizeDepartmentName(displayName);
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      id: departmentIdForName(name),
      name,
      displayName,
    });
  }

  const rows = Array.from(byName.values());
  for (const department of rows) {
    await db
      .insert(departments)
      .values({
        id: department.id,
        name: department.name,
        displayName: department.displayName,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: departments.name,
        set: {
          displayName: department.displayName,
          isActive: true,
        },
      });
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function candidateLang(candidate: typeof candidates.$inferSelect | undefined, fallback: Lang): Lang {
  const lang = candidate?.languagePref ?? candidate?.language ?? fallback;
  return lang === "ru" || lang === "uz" || lang === "en" ? lang : fallback;
}

async function getCandidateByTelegramId(telegramUserId: string) {
  const rows = await db.select().from(candidates).where(eq(candidates.telegramUserId, telegramUserId));
  return rows[0] ?? null;
}

// ---- /start ----
export async function handleStart(ctx: Context) {
  const lang = detectLang(ctx);
  const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";
  const telegramUserId = String(ctx.from!.id);
  const candidate = await getCandidateByTelegramId(telegramUserId);
  const vacancyId = payload ? payload.split("_")[0] : undefined;

  if (candidate && !candidate.profileCompleted) {
    await startAnketa(ctx, candidate.id, lang, vacancyId);
    return;
  }

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

  await startVacancyFlow(ctx, vacancyId!, lang);
}

async function startVacancyFlow(ctx: Context, vacancyId: string, lang: Lang) {
  const vacancy = await getLiveActiveVacancy(vacancyId);
  if (!vacancy) {
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

  const candidateId = (ctx as any).state?.candidateId as string | undefined;
  let browsingApplicationId: string | null = null;
  if (candidateId) {
    browsingApplicationId = await getOrCreateBrowsingApplication({ candidateId, vacancyId });
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

  if (browsingApplicationId) {
    await saveBotSession(String(ctx.from!.id), {
      vacancyId,
      applicationId: browsingApplicationId,
      state: "complete",
      currentQuestionIndex: 0,
      collectedData: {},
    });
  }

  await ctx.reply(header, { reply_markup: kb, parse_mode: "Markdown" });
}

// ---- Callback queries ----
export async function handleCallbackQuery(ctx: Context) {
  const lang = detectLang(ctx);
  const data = ctx.callbackQuery?.data ?? "";
  await ctx.answerCallbackQuery();

  if (data.startsWith("anketa_")) {
    return handleAnketaCallback(ctx, data, lang);
  }

  if (data.startsWith("view_")) {
    const vacancyId = data.replace("view_", "");
    return startVacancyFlow(ctx, vacancyId, lang);
  }

  if (data.startsWith("apply_")) {
    const vacancyId = data.replace("apply_", "");
    const telegramUserId = String(ctx.from!.id);
    const vacancy = await getLiveActiveVacancy(vacancyId);

    if (!vacancy) {
      await clearBotSession(telegramUserId);
      return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
    }

    // Check for duplicate application
    const existingCand = await db.select().from(candidates)
      .where(eq(candidates.telegramUserId, telegramUserId));
    if (existingCand[0]) {
      if (!existingCand[0].profileCompleted) {
        await startAnketa(ctx, existingCand[0].id, candidateLang(existingCand[0], lang), vacancyId);
        return;
      }

      const existingApp = await db.select().from(applications)
        .where(and(eq(applications.candidateId, existingCand[0].id), eq(applications.vacancyId, vacancyId)));
      if (existingApp[0]?.status === "submitted") {
        return ctx.reply(tr(lang, "already_applied", { vacancy: vacancy.title }), { parse_mode: "Markdown" });
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
      // Telegram has no data-mode cookie: bot-created applications are Live-only.
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
  const activeVacancies = await db.select().from(vacancies).where(and(eq(vacancies.status, "active"), eq(vacancies.isDemo, false)));

  if (!activeVacancies.length) {
    return ctx.reply(tr(lang, "no_jobs"), { parse_mode: "Markdown" });
  }

  const kb = new InlineKeyboard();
  for (const v of activeVacancies) {
    const salary = v.salaryMin > 0 && v.salaryMax > 0
      ? ` · $${Math.round(v.salaryMin / 1000)}k–$${Math.round(v.salaryMax / 1000)}k`
      : "";
    kb.text(`${v.title}${salary}`, `view_${v.id}`).row();
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
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false)))
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
    .select({ app: applications })
    .from(applications)
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false)))
    .where(eq(applications.candidateId, candRows[0].id))
    .orderBy(applications.appliedAt);
  const latestApp = appRows[appRows.length - 1]?.app;
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

  // Inbound persistence is handled by middleware, including attachment metadata.
}

// ---- text/document messages during application flow ----
export async function handleText(ctx: Context) {
  const lang = detectLang(ctx);
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);

  if (!session?.state || session.state === "complete") {
    return ctx.reply(tr(lang, "session_timeout"), { parse_mode: "Markdown" });
  }

  const text = ctx.message?.text?.trim() ?? "";
  const data = (session.collectedData as Record<string, unknown>) ?? {};
  const totalSteps = (data.totalSteps as number) ?? 6;

  if (ANKETA_STATES.has(session.state)) {
    return handleAnketaText(ctx, text, lang);
  }

  const vacancy = session.vacancyId ? await getLiveActiveVacancy(session.vacancyId) : null;

  if (!vacancy) {
    await clearBotSession(telegramUserId);
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, session.vacancyId!))
    .orderBy(asc(screeningQuestions.orderIndex));

  if (session.state === "awaiting_name") {
    if (!text) return ctx.reply(tr(lang, "ask_name", { step: 1, total: totalSteps }), { parse_mode: "Markdown" });
    const applicationId = await ensureInProgressApplication(ctx, telegramUserId, session.vacancyId!, data);
    data.fullName = text;
    await saveBotSession(telegramUserId, { applicationId, state: "awaiting_email", collectedData: data });
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

async function ensureInProgressApplication(
  ctx: Context,
  telegramUserId: string,
  vacancyId: string,
  data: Record<string, unknown>
): Promise<string | null> {
  const session = await getBotSession(telegramUserId);
  if (session?.applicationId) {
    await ensureApplicationInProgress(session.applicationId).catch((err) => {
      console.error("[ensureInProgressApplication] upgrade existing failed:", err);
    });
    return session.applicationId;
  }

  const candidateId = (ctx as any).state?.candidateId as string | undefined;
  if (!candidateId) return null;
  return getOrCreateInProgressApplication({ candidateId, vacancyId });
}

async function startAnketa(ctx: Context, candidateId: string, fallbackLang: Lang, pendingVacancyId?: string) {
  const telegramUserId = String(ctx.from!.id);
  await saveBotSession(telegramUserId, {
    vacancyId: pendingVacancyId ?? null,
    applicationId: null,
    state: "awaiting_lang_pref",
    collectedData: { candidateId, pendingVacancyId: pendingVacancyId ?? null },
  });

  const kb = new InlineKeyboard()
    .text("🇷🇺 Русский", "anketa_lang_ru")
    .text("🇺🇿 O'zbekcha", "anketa_lang_uz")
    .text("🇬🇧 English", "anketa_lang_en");

  await ctx.reply(tr(fallbackLang, "welcome_dual"), { parse_mode: "Markdown" });
  await ctx.reply(tr(fallbackLang, "ask_language"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function handleAnketaCallback(ctx: Context, data: string, fallbackLang: Lang) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);
  const candidate = await getCandidateByTelegramId(telegramUserId);
  if (!session || !candidate || !ANKETA_STATES.has(session.state)) return;

  const sessionData = ((session.collectedData as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const lang = candidateLang(candidate, fallbackLang);

  if (data.startsWith("anketa_lang_") && session.state === "awaiting_lang_pref") {
    const selected = data.replace("anketa_lang_", "") as Lang;
    const nextLang: Lang = selected === "ru" || selected === "uz" || selected === "en" ? selected : lang;
    await db.update(candidates)
      .set({ languagePref: nextLang, language: nextLang })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_department", collectedData: sessionData });
    return askDepartment(ctx, nextLang);
  }

  if (data.startsWith("anketa_department_") && session.state === "awaiting_department") {
    const departmentId = data.replace("anketa_department_", "");
    const dept = await db.select().from(departments).where(and(eq(departments.id, departmentId), eq(departments.isActive, true)));
    const botVisibleDepartments = await getBotVisibleDepartments();
    const isBotVisibleDepartment = dept[0] && botVisibleDepartments.some((department) => department.name === dept[0].name);
    if (!isBotVisibleDepartment) return askDepartment(ctx, lang);

    await db.update(candidates)
      .set({ departmentId })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_full_name", collectedData: sessionData });
    return ctx.reply(tr(lang, "ask_full_name"), { parse_mode: "Markdown" });
  }

  if (data.startsWith("anketa_marital_") && session.state === "awaiting_marital_status") {
    const status = data.replace("anketa_marital_", "");
    if (!["single", "married", "divorced", "other"].includes(status)) {
      return askMarital(ctx, lang);
    }
    await db.update(candidates)
      .set({ maritalStatus: status })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_student_status", collectedData: sessionData });
    return askStudent(ctx, lang);
  }

  if (data.startsWith("anketa_student_") && session.state === "awaiting_student_status") {
    const isStudent = data.endsWith("_yes");
    await db.update(candidates)
      .set({ isStudent })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_education_field", collectedData: sessionData });
    return ctx.reply(tr(lang, "ask_education"), { parse_mode: "Markdown" });
  }

  if (data.startsWith("anketa_english_") && session.state === "awaiting_english_level") {
    const level = data.replace("anketa_english_", "");
    if (!isLanguageLevel(level)) return askLanguageLevel(ctx, "english", lang);
    await db.update(candidates)
      .set({ englishLevel: level })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_russian_level", collectedData: sessionData });
    return askLanguageLevel(ctx, "russian", lang);
  }

  if (data.startsWith("anketa_russian_") && session.state === "awaiting_russian_level") {
    const level = data.replace("anketa_russian_", "");
    if (!isLanguageLevel(level)) return askLanguageLevel(ctx, "russian", lang);
    await db.update(candidates)
      .set({ russianLevel: level })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_work_company", collectedData: sessionData });
    return askWorkCompany(ctx, lang);
  }

  if (data === "anketa_work_none" && session.state === "awaiting_work_company") {
    await db.update(candidates)
      .set({ workExperience: [] })
      .where(eq(candidates.id, candidate.id));
    return finishAnketa(ctx, candidate.id, lang, sessionData);
  }

  if (data === "anketa_work_more_yes") {
    sessionData.pendingExp = {};
    await saveBotSession(telegramUserId, { state: "awaiting_work_company", collectedData: sessionData });
    return askWorkCompany(ctx, lang);
  }

  if (data === "anketa_work_more_no") {
    return finishAnketa(ctx, candidate.id, lang, sessionData);
  }
}

export async function handleContact(ctx: Context) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);
  if (session?.state !== "awaiting_phone") return handleText(ctx);

  const candidate = await getCandidateByTelegramId(telegramUserId);
  if (!candidate) return;

  const lang = candidateLang(candidate, detectLang(ctx));
  const phone = ctx.message?.contact?.phone_number;
  if (!phone) return askPhone(ctx, lang);

  await db.update(candidates)
    .set({ phone })
    .where(eq(candidates.id, candidate.id));
  await saveBotSession(telegramUserId, {
    state: "awaiting_marital_status",
    collectedData: (session.collectedData as Record<string, unknown>) ?? {},
  });
  return askMarital(ctx, lang);
}

async function handleAnketaText(ctx: Context, text: string, fallbackLang: Lang) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);
  const candidate = await getCandidateByTelegramId(telegramUserId);
  if (!session || !candidate) return;

  const lang = candidateLang(candidate, fallbackLang);
  const data = ((session.collectedData as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  if (!text || text.length > 500) {
    return ctx.reply(tr(lang, "err_short_text"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_full_name") {
    await db.update(candidates)
      .set({ fullName: text })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_dob", collectedData: data });
    return ctx.reply(tr(lang, "ask_dob"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_dob") {
    const dob = parseDob(text);
    if (!dob) return ctx.reply(tr(lang, "err_dob_format"), { parse_mode: "Markdown" });
    await db.update(candidates)
      .set({ dateOfBirth: dob })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_address", collectedData: data });
    return ctx.reply(tr(lang, "ask_address"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_address") {
    await db.update(candidates)
      .set({ address: text, city: text })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_phone", collectedData: data });
    return askPhone(ctx, lang);
  }

  if (session.state === "awaiting_phone") {
    await db.update(candidates)
      .set({ phone: text })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_marital_status", collectedData: data });
    return askMarital(ctx, lang);
  }

  if (session.state === "awaiting_education_field") {
    await db.update(candidates)
      .set({ educationField: text })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_english_level", collectedData: data });
    return askLanguageLevel(ctx, "english", lang);
  }

  if (session.state === "awaiting_work_company") {
    data.pendingExp = { company: text } satisfies WorkExperienceDraft;
    await saveBotSession(telegramUserId, { state: "awaiting_work_position", collectedData: data });
    return ctx.reply(tr(lang, "ask_work_position"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_work_position") {
    const pending = ((data.pendingExp as WorkExperienceDraft | undefined) ?? {}) as WorkExperienceDraft;
    data.pendingExp = { ...pending, position: text };
    await saveBotSession(telegramUserId, { state: "awaiting_work_period", collectedData: data });
    return ctx.reply(tr(lang, "ask_work_period"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_work_period") {
    const pending = ((data.pendingExp as WorkExperienceDraft | undefined) ?? {}) as WorkExperienceDraft;
    data.pendingExp = { ...pending, period: text };
    await saveBotSession(telegramUserId, { state: "awaiting_work_leave_reason", collectedData: data });
    return ctx.reply(tr(lang, "ask_work_reason"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_work_leave_reason") {
    const pending = ((data.pendingExp as WorkExperienceDraft | undefined) ?? {}) as WorkExperienceDraft;
    const completed = { ...pending, leaveReason: text };
    const existing = Array.isArray(data.workExperience)
      ? (data.workExperience as WorkExperienceDraft[])
      : [];
    const workExperience = [...existing, completed];
    data.workExperience = workExperience;
    delete data.pendingExp;

    await db.update(candidates)
      .set({ workExperience })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_work_company", collectedData: data });
    return askWorkMore(ctx, lang);
  }
}

async function askDepartment(ctx: Context, lang: Lang) {
  const rows = await getBotVisibleDepartments();
  const kb = new InlineKeyboard();
  for (const department of rows) {
    kb.text(department.displayName, `anketa_department_${department.id}`).row();
  }

  if (rows.length === 0) {
    await ctx.reply(tr(lang, "no_jobs"), { parse_mode: "Markdown" });
    return;
  }

  await ctx.reply(tr(lang, "ask_department"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askPhone(ctx: Context, lang: Lang) {
  const kb = new Keyboard()
    .requestContact(tr(lang, "ask_phone"))
    .resized()
    .oneTime();
  await ctx.reply(tr(lang, "ask_phone"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askMarital(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "marital_single"), "anketa_marital_single")
    .text(tr(lang, "marital_married"), "anketa_marital_married").row()
    .text(tr(lang, "marital_divorced"), "anketa_marital_divorced")
    .text(tr(lang, "marital_other"), "anketa_marital_other");
  await ctx.reply(tr(lang, "ask_marital"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askStudent(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "btn_yes"), "anketa_student_yes")
    .text(tr(lang, "btn_no"), "anketa_student_no");
  await ctx.reply(tr(lang, "ask_student"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askLanguageLevel(ctx: Context, kind: "english" | "russian", lang: Lang) {
  const prefix = kind === "english" ? "anketa_english" : "anketa_russian";
  const kb = new InlineKeyboard()
    .text("None", `${prefix}_none`)
    .text("A1-A2", `${prefix}_a1_a2`).row()
    .text("B1-B2", `${prefix}_b1_b2`)
    .text("C1-C2", `${prefix}_c1_c2`).row()
    .text("Native", `${prefix}_native`);
  await ctx.reply(tr(lang, kind === "english" ? "ask_english" : "ask_russian"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askWorkCompany(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard().text(tr(lang, "btn_no_experience"), "anketa_work_none");
  await ctx.reply(tr(lang, "ask_work_company"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askWorkMore(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "btn_yes"), "anketa_work_more_yes")
    .text(tr(lang, "btn_no"), "anketa_work_more_no");
  await ctx.reply(tr(lang, "ask_work_more"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function finishAnketa(ctx: Context, candidateId: string, lang: Lang, data: Record<string, unknown>) {
  const telegramUserId = String(ctx.from!.id);
  await db.update(candidates)
    .set({ profileCompleted: true })
    .where(eq(candidates.id, candidateId));
  await clearBotSession(telegramUserId);
  await ctx.reply(tr(lang, "profile_complete"), { parse_mode: "Markdown" });

  const pendingVacancyId = typeof data.pendingVacancyId === "string" ? data.pendingVacancyId : null;
  if (pendingVacancyId) {
    await startVacancyFlow(ctx, pendingVacancyId, lang);
  } else {
    await handleJobs(ctx);
  }
}

function isLanguageLevel(value: string): value is "none" | "a1_a2" | "b1_b2" | "c1_c2" | "native" {
  return ["none", "a1_a2", "b1_b2", "c1_c2", "native"].includes(value);
}

function parseDob(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;

  return age >= 14 && age <= 99 ? date : null;
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
  const vacancy = await getLiveActiveVacancy(vacancyId);

  if (!vacancy) {
    await clearBotSession(String(ctx.from!.id));
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

  const lines = [
    tr(lang, "review_header"),
    tr(lang, "review_name", { value: String(data.fullName ?? "—") }),
    tr(lang, "review_email", { value: String(data.email ?? "—") }),
    tr(lang, "review_position", { value: vacancy.title }),
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
  const vacancy = session.vacancyId ? await getLiveActiveVacancy(session.vacancyId) : null;

  if (!vacancy) {
    await clearBotSession(telegramUserId);
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

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
      // Telegram has no data-mode cookie: bot-created candidates/applications are Live-only.
      const candidateId = (ctx as any).state?.candidateId as string | undefined;
      if (candidateId) {
        const liveAppId = await getOrCreateInProgressApplication({ candidateId, vacancyId: session.vacancyId! });
        const answers = (data.answers as Record<string, string>) ?? {};
        for (const [questionId, answerText] of Object.entries(answers)) {
          if (!answerText) continue;
          await saveScreeningAnswerLive({ applicationId: liveAppId, questionId, answerText });
        }
        await finalizeApplicationDetails({
          applicationId: liveAppId,
          fullName: String(data.fullName ?? ctx.from!.first_name),
          email: data.email ? String(data.email) : undefined,
          notes: data.notes ? String(data.notes) : undefined,
          cvFileId: data.cvFileId ? String(data.cvFileId) : undefined,
          cvFilename: data.cvFilename ? String(data.cvFilename) : undefined,
        });
        await submitApplication(liveAppId);
        appId = liveAppId;
      } else {
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
    }

    await clearBotSession(telegramUserId);

    const id = appId ?? "unknown";
    await ctx.reply(
      tr(lang, "submitted", {
        id: id.slice(0, 8).toUpperCase(),
        vacancy: vacancy.title,
      }),
      { parse_mode: "Markdown" }
    );

    await notifyHR(ctx, id, vacancy.title, data);
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
