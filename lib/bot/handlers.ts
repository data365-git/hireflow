import { InlineKeyboard, Keyboard } from "grammy";
import type { Context } from "grammy";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions, screeningAnswers, applications, candidates, departments, botContent, feedback } from "@/lib/db/schema";
import { saveBotMessageRecord } from "./messageLog";
import { eq, and, asc, desc, gte, isNull } from "drizzle-orm";
import { getBotSession, saveBotSession, clearBotSession, createApplicationFromBot, getOrCreateBrowsingApplication, createInProgressApplication, ensureApplicationInProgress, saveScreeningAnswerLive, submitApplication, abandonApplication, finalizeApplicationDetails, setCandidatePhotoFileId, recordConsent, createFreshApplication } from "@/app/actions/bot";
import { detectLang, tr, type Lang } from "./i18n";
import { resolveBotLang } from "./lang";

const vacancyNotDeleted = isNull(vacancies.deletedAt);

async function getLiveActiveVacancy(vacancyId: string) {
  const rows = await db.select().from(vacancies).where(and(eq(vacancies.id, vacancyId), eq(vacancies.isDemo, false), vacancyNotDeleted));
  const vacancy = rows[0];
  return vacancy?.status === "active" ? vacancy : null;
}

const ANKETA_STATES = new Set([
  "awaiting_lang_pref",
  "awaiting_department",
  "awaiting_full_name",
  "awaiting_dob",
  "awaiting_address",
  "awaiting_phone_confirm",
  "awaiting_phone",
  "awaiting_marital_status",
  "awaiting_student_status",
  "awaiting_education_institution",
  "awaiting_education_field",
  "awaiting_study_form",
  "awaiting_study_year",
  "awaiting_english_level",
  "awaiting_russian_level",
  "awaiting_work_company",
  "awaiting_work_position",
  "awaiting_work_period",
  "awaiting_work_leave_reason",
  "awaiting_photo",
]);

async function clearSessionAndAbandon(telegramUserId: string, applicationId?: string | null) {
  if (applicationId) {
    await abandonApplication(applicationId).catch((err) => {
      console.error("[clearSessionAndAbandon] abandonApplication failed:", err);
    });
  }
  await clearBotSession(telegramUserId);
}

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
    .where(and(eq(vacancies.status, "active"), eq(vacancies.isDemo, false), vacancyNotDeleted))
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

function botAdminIds(): string[] {
  return (process.env.BOT_ADMIN_TELEGRAM_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function isBotAdminTelegramUser(telegramUserId: string): boolean {
  return botAdminIds().includes(telegramUserId);
}

function hasStablePrefillData(candidate: typeof candidates.$inferSelect): boolean {
  return Boolean(
    candidate.fullName &&
    candidate.dateOfBirth &&
    (candidate.educationField || candidate.educationInstitution || candidate.englishLevel || candidate.russianLevel)
  );
}

function formatDateForBot(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
}

function buildStablePrefillSummary(candidate: typeof candidates.$inferSelect): string {
  return [
    `👤 ${candidate.fullName}`,
    candidate.dateOfBirth ? `📅 ${formatDateForBot(candidate.dateOfBirth)}` : null,
    candidate.maritalStatus ? `💍 ${candidate.maritalStatus}` : null,
    candidate.educationInstitution ? `🎓 ${candidate.educationInstitution}` : null,
    candidate.educationField ? `📚 ${candidate.educationField}` : null,
    candidate.englishLevel ? `🇬🇧 EN: ${candidate.englishLevel}` : null,
    candidate.russianLevel ? `🇷🇺 RU: ${candidate.russianLevel}` : null,
  ].filter(Boolean).join("\n");
}

function candidateEmail(candidate: typeof candidates.$inferSelect | null | undefined): string | null {
  const phone = candidate?.phone?.trim();
  return phone && isValidEmail(phone) ? phone : null;
}

async function showMainMenu(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "btn_browse_jobs"), "browse_jobs").row()
    .text(tr(lang, "btn_inquiries"), "inquiries").row()
    .text(tr(lang, "btn_suggestion"), "feedback_suggestion");

  await ctx.reply(
    `${tr(lang, "welcome_no_payload")}\n\n${tr(lang, "welcome_browse")}`,
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}

async function showInquiriesMenu(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "btn_about_us"), "about_us").row()
    .text(tr(lang, "btn_contact_us"), "contact_us").row()
    .text(tr(lang, "btn_complaint"), "feedback_complaint").row()
    .text(tr(lang, "btn_back"), "main_menu");

  await ctx.reply(tr(lang, "inquiries_prompt"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askFirstLanguage(ctx: Context, payload: string) {
  const telegramUserId = String(ctx.from!.id);
  const parts = payload ? payload.split("_") : [];
  await saveBotSession(telegramUserId, {
    vacancyId: parts[0] || null,
    state: "awaiting_first_lang",
    collectedData: {
      sourceId: parts[1] || null,
    },
  });

  const kb = new InlineKeyboard()
    .text("🇺🇿 O'zbekcha", "first_lang_uz").row()
    .text("🇬🇧 English", "first_lang_en").row()
    .text("🇷🇺 Русский", "first_lang_ru");

  const welcome = [
    "👋 *Xush kelibsiz!*",
    "👋 *Welcome!*",
    "👋 *Добро пожаловать!*",
    "",
    "Iltimos, tilni tanlang / Please choose your language / Выберите язык:",
  ].join("\n");

  await ctx.reply(welcome, { reply_markup: kb, parse_mode: "Markdown" });
}

async function clearInlineKeyboard(ctx: Context) {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // Telegram may reject edits for old or already-edited messages. The action should still continue.
  }
}

// ---- /start ----
export async function handleStart(ctx: Context) {
  const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";
  const telegramUserId = String(ctx.from!.id);
  const candidate = await getCandidateByTelegramId(telegramUserId);

  if (!candidate?.languagePref) {
    await askFirstLanguage(ctx, payload);
    return;
  }

  const lang = candidateLang(candidate, await resolveBotLang(ctx));
  const parts = payload ? payload.split("_") : [];
  const vacancyId = parts[0] || undefined;
  const sourceId = parts[1] || undefined;

  if (!payload) {
    await clearBotSession(telegramUserId);
    await showMainMenu(ctx, lang);
    return;
  }

  await clearBotSession(telegramUserId);
  await startVacancyFlow(ctx, vacancyId!, lang, sourceId);
}

async function startVacancyFlow(ctx: Context, vacancyId: string, lang: Lang, sourceId?: string) {
  const vacancy = await getLiveActiveVacancy(vacancyId);
  if (!vacancy) {
    // Fetch closed vacancy to get its department for similar-vacancy matching
    const closedRows = await db
      .select()
      .from(vacancies)
      .where(and(eq(vacancies.id, vacancyId), eq(vacancies.isDemo, false), vacancyNotDeleted));
    const closedVacancy = closedRows[0];

    let similarVacancies = await db
      .select()
      .from(vacancies)
      .where(and(eq(vacancies.status, "active"), eq(vacancies.isDemo, false), vacancyNotDeleted))
      .orderBy(desc(vacancies.createdAt))
      .limit(3);

    // Prefer matches in the same department when possible
    if (closedVacancy?.department) {
      const byDept = similarVacancies.filter((v) => v.department === closedVacancy.department);
      if (byDept.length > 0) similarVacancies = byDept;
    }

    if (similarVacancies.length > 0) {
      const kb = new InlineKeyboard();
      for (const v of similarVacancies) {
        kb.text(v.title, `view_${v.id}`).row();
      }
      await ctx.reply(tr(lang, "position_closed_with_suggestions"), { reply_markup: kb, parse_mode: "Markdown" });
    } else {
      const kb = new InlineKeyboard().text(tr(lang, "btn_browse_all_jobs"), "browse_jobs");
      await ctx.reply(tr(lang, "position_closed_no_matches"), { reply_markup: kb, parse_mode: "Markdown" });
    }
    return;
  }

  const candidateId = (ctx as any).state?.candidateId as string | undefined;
  let browsingApplicationId: string | null = null;
  if (candidateId) {
    browsingApplicationId = await getOrCreateBrowsingApplication({ candidateId, vacancyId, sourceId });
  }

  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, vacancyId))
    .orderBy(asc(screeningQuestions.orderIndex));

  // +2 for name + email, +3 for portfolio + motivation + consent/review
  const totalSteps = 2 + questions.length + 3;
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
    .text(tr(lang, "btn_other_jobs"), "browse_jobs");

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
  const lang = await resolveBotLang(ctx);
  const data = ctx.callbackQuery?.data ?? "";
  await ctx.answerCallbackQuery();

  if (data.startsWith("anketa_")) {
    return handleAnketaCallback(ctx, data, lang);
  }

  if (data.startsWith("qans_")) {
    return handleQansCallback(ctx, data, lang);
  }

  if (data.startsWith("first_lang_")) {
    const selected = data.replace("first_lang_", "") as Lang;
    const nextLang: Lang = selected === "ru" || selected === "uz" || selected === "en" ? selected : "uz";
    const telegramUserId = String(ctx.from!.id);
    const candidate = await getCandidateByTelegramId(telegramUserId);

    if (candidate) {
      await db.update(candidates)
        .set({ languagePref: nextLang, language: nextLang })
        .where(eq(candidates.id, candidate.id));
    } else {
      await db.insert(candidates).values({
        id: crypto.randomUUID(),
        fullName: ctx.from?.first_name ?? "",
        phone: "",
        telegramUsername: ctx.from?.username ?? "",
        telegramFirstName: ctx.from?.first_name ?? "",
        telegramUserId,
        language: nextLang,
        languagePref: nextLang,
        city: "",
        isDemo: false,
        createdAt: new Date(),
      });
    }

    const session = await getBotSession(telegramUserId);
    const sourceId = ((session?.collectedData as Record<string, unknown> | null)?.sourceId ?? undefined) as string | undefined;
    const pendingVacancyId = session?.vacancyId ?? null;
    await clearBotSession(telegramUserId);

    if (pendingVacancyId) {
      return startVacancyFlow(ctx, pendingVacancyId, nextLang, sourceId);
    }
    return showMainMenu(ctx, nextLang);
  }

  if (data.startsWith("view_")) {
    const vacancyId = data.replace("view_", "");
    return startVacancyFlow(ctx, vacancyId, lang);
  }

  if (data.startsWith("prefill_use_stable_")) {
    const vacancyId = data.replace("prefill_use_stable_", "");
    const telegramUserId = String(ctx.from!.id);
    const candidate = await getCandidateByTelegramId(telegramUserId);
    if (!candidate?.profileCompleted) {
      return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
    }
    return startApplicationScreening(ctx, vacancyId, candidateLang(candidate, lang), candidate, { forceReaskStable: false });
  }

  if (data.startsWith("prefill_review_")) {
    const vacancyId = data.replace("prefill_review_", "");
    const telegramUserId = String(ctx.from!.id);
    const candidate = await getCandidateByTelegramId(telegramUserId);
    if (!candidate) return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
    await clearBotSession(telegramUserId);
    return startAnketa(ctx, candidate.id, candidateLang(candidate, lang), vacancyId);
  }

  if (data.startsWith("apply_")) {
    const vacancyId = data.replace("apply_", "");
    const telegramUserId = String(ctx.from!.id);
    const vacancy = await getLiveActiveVacancy(vacancyId);

    if (!vacancy) {
      await clearBotSession(telegramUserId);
      return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
    }

    const existingCand = await db.select().from(candidates)
      .where(eq(candidates.telegramUserId, telegramUserId));
    const isBotAdmin = isBotAdminTelegramUser(telegramUserId);
    if (existingCand[0]) {
      if (!existingCand[0].profileCompleted) {
        await startAnketa(ctx, existingCand[0].id, candidateLang(existingCand[0], lang), vacancyId);
        return;
      }

      if (!isBotAdmin) {
        const existingSubmitted = await db
          .select({ id: applications.id })
          .from(applications)
          .where(and(
            eq(applications.candidateId, existingCand[0].id),
            eq(applications.vacancyId, vacancyId),
            eq(applications.status, "submitted"),
            gte(applications.appliedAt, vacancy.lastActivatedAt)
          ))
          .limit(1);

        if (existingSubmitted[0]) {
          return ctx.reply(tr(lang, "already_applied", { vacancy: vacancy.title }), { parse_mode: "Markdown" });
        }
      }

      if (!isBotAdmin && hasStablePrefillData(existingCand[0])) {
        await saveBotSession(telegramUserId, {
          vacancyId,
          applicationId: null,
          state: "awaiting_prefill_stable",
          collectedData: { candidateId: existingCand[0].id },
        });
        const kb = new InlineKeyboard()
          .text(tr(lang, "btn_use_existing"), `prefill_use_stable_${vacancyId}`).row()
          .text(tr(lang, "btn_update_some"), `prefill_review_${vacancyId}`);
        return ctx.reply(
          tr(candidateLang(existingCand[0], lang), "prefill_stable_confirm", {
            summary: buildStablePrefillSummary(existingCand[0]),
          }),
          { reply_markup: kb, parse_mode: "Markdown" }
        );
      }
    }

    return startApplicationScreening(ctx, vacancyId, lang, existingCand[0] ?? null, { forceReaskStable: isBotAdmin });
  }

  if (data.startsWith("reapply_")) {
    const reapplyVacancyId = data.replace("reapply_", "");
    const telegramUserId = String(ctx.from!.id);
    const vacancy = await getLiveActiveVacancy(reapplyVacancyId);
    if (!vacancy) {
      return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
    }
    const candRows = await db.select().from(candidates).where(eq(candidates.telegramUserId, telegramUserId));
    if (!candRows[0] || !candRows[0].profileCompleted) {
      return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
    }
    const candidateId = candRows[0].id;
    const applicationId = await createFreshApplication({ candidateId, vacancyId: reapplyVacancyId });
    const questions = await db.select().from(screeningQuestions)
      .where(eq(screeningQuestions.vacancyId, reapplyVacancyId))
      .orderBy(asc(screeningQuestions.orderIndex));
    const totalSteps = 2 + questions.length + 3;
    const collectedData: Record<string, unknown> = {
      totalSteps,
      fullName: candRows[0].fullName,
    };
    await saveBotSession(telegramUserId, {
      vacancyId: reapplyVacancyId,
      applicationId,
      state: candidateEmail(candRows[0]) ? "awaiting_email_confirm" : "awaiting_email",
      currentQuestionIndex: 0,
      collectedData,
    });
    const existingEmail = candidateEmail(candRows[0]);
    if (existingEmail) {
      const kb = new InlineKeyboard()
        .text(tr(lang, "btn_email_use_existing"), "email_use_existing").row()
        .text(tr(lang, "btn_email_enter_new"), "email_enter_new");
      await ctx.reply(tr(lang, "email_confirm", { email: existingEmail }), { reply_markup: kb, parse_mode: "Markdown" });
      return;
    }
    await ctx.reply(tr(lang, "ask_email", { step: 2, total: totalSteps }), { parse_mode: "Markdown" });
    return;
  }

  if (data === "consent_yes") {
    const telegramUserId = String(ctx.from!.id);
    const consentSession = await getBotSession(telegramUserId);
    const consentCandidate = await getCandidateByTelegramId(telegramUserId);
    if (!consentSession || !consentCandidate) return;
    const consentLang = candidateLang(consentCandidate, lang);
    await recordConsent({ candidateId: consentCandidate.id, version: "v1-2026-05" });
    const consentData = (consentSession.collectedData as Record<string, unknown>) ?? {};
    await saveBotSession(telegramUserId, { state: "awaiting_review", collectedData: consentData });
    return showReview(ctx, consentSession.vacancyId!, consentData, consentLang);
  }

  if (data === "consent_no") {
    const telegramUserId = String(ctx.from!.id);
    const consentSession = await getBotSession(telegramUserId);
    const consentCandidate = await getCandidateByTelegramId(telegramUserId);
    const consentLang = consentCandidate ? candidateLang(consentCandidate, lang) : lang;
    await clearSessionAndAbandon(telegramUserId, consentSession?.applicationId);
    return ctx.reply(tr(consentLang, "consent_required"), { parse_mode: "Markdown" });
  }

  if (data === "about_us") {
    const [row] = await db.select({ content: botContent.content })
      .from(botContent)
      .where(and(eq(botContent.key, "about_us"), eq(botContent.language, lang)));
    const text = row?.content ?? tr(lang, "about_us_fallback");
    return ctx.reply(text, { parse_mode: "Markdown" });
  }

  if (data === "inquiries") {
    return showInquiriesMenu(ctx, lang);
  }

  if (data === "main_menu") {
    return showMainMenu(ctx, lang);
  }

  if (data === "contact_us") {
    const telegramUserId = String(ctx.from!.id);
    await saveBotSession(telegramUserId, { state: "awaiting_contact_message", currentQuestionIndex: 0, collectedData: {} });
    return ctx.reply(tr(lang, "contact_us_prompt"), { parse_mode: "Markdown" });
  }

  if (data === "feedback") {
    const kb = new InlineKeyboard()
      .text(tr(lang, "btn_complaint"), "feedback_complaint").row()
      .text(tr(lang, "btn_suggestion"), "feedback_suggestion");
    return ctx.reply(tr(lang, "feedback_prompt"), { reply_markup: kb, parse_mode: "Markdown" });
  }

  if (data === "feedback_complaint" || data === "feedback_suggestion") {
    const telegramUserId = String(ctx.from!.id);
    const kind = data === "feedback_complaint" ? "complaint" : "suggestion";
    await saveBotSession(telegramUserId, {
      state: "awaiting_feedback_text",
      currentQuestionIndex: 0,
      collectedData: { feedbackKind: kind },
    });
    return ctx.reply(tr(lang, kind === "complaint" ? "ask_complaint" : "ask_suggestion"), { parse_mode: "Markdown" });
  }

  if (data === "email_use_existing" || data === "email_enter_new") {
    const telegramUserId = String(ctx.from!.id);
    const session = await getBotSession(telegramUserId);
    if (!session || session.state !== "awaiting_email_confirm") return;

    const candidate = await getCandidateByTelegramId(telegramUserId);
    const email = candidateEmail(candidate);
    const emailData = ((session.collectedData as Record<string, unknown>) ?? {}) as Record<string, unknown>;

    if (data === "email_use_existing" && email) {
      emailData.email = email;
      await saveBotSession(telegramUserId, { state: "awaiting_email", collectedData: emailData });
      return continueAfterEmail(ctx, session, emailData, candidate ? candidateLang(candidate, lang) : lang);
    }

    await saveBotSession(telegramUserId, { state: "awaiting_email", collectedData: emailData });
    return ctx.reply(tr(candidate ? candidateLang(candidate, lang) : lang, "ask_email", {
      step: 2,
      total: (emailData.totalSteps as number) ?? 6,
    }), { parse_mode: "Markdown" });
  }

  if (data === "phone_use_existing" || data === "phone_enter_new") {
    const telegramUserId = String(ctx.from!.id);
    const session = await getBotSession(telegramUserId);
    if (!session || session.state !== "awaiting_phone_confirm") return;

    const candidate = await getCandidateByTelegramId(telegramUserId);
    const phoneData = ((session.collectedData as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const resolvedLang = candidate ? candidateLang(candidate, lang) : lang;

    if (data === "phone_use_existing" && candidate?.phone) {
      // Phone already saved on candidate — skip to marital
      await saveBotSession(telegramUserId, { state: "awaiting_marital_status", collectedData: phoneData });
      return askMarital(ctx, resolvedLang);
    }

    // Enter new phone
    await saveBotSession(telegramUserId, { state: "awaiting_phone", collectedData: phoneData });
    return askPhone(ctx, resolvedLang);
  }

  if (data.startsWith("dept_")) {
    return showJobs(ctx, data);
  }

  if (data === "browse_jobs") return handleJobs(ctx);
  if (data === "my_applications") return handleStatus(ctx);
  if (data === "help") return handleHelp(ctx);
  if (data === "not_interested") {
    const session = await getBotSession(String(ctx.from!.id));
    await clearSessionAndAbandon(String(ctx.from!.id), session?.applicationId);
    return ctx.reply(tr(lang, "cancelled"), { parse_mode: "Markdown" });
  }
  if (data === "submit_confirm") {
    await clearInlineKeyboard(ctx);
    return handleSubmitConfirm(ctx, lang);
  }
  if (data === "submit_cancel") {
    await clearInlineKeyboard(ctx);
    const kb = new InlineKeyboard()
      .text(tr(lang, "btn_yes"), "submit_cancel_confirm").row()
      .text(tr(lang, "btn_no"), "submit_cancel_abort");
    return ctx.reply(tr(lang, "confirm_cancel"), { reply_markup: kb, parse_mode: "Markdown" });
  }
  if (data === "submit_cancel_confirm") {
    await clearInlineKeyboard(ctx);
    const session = await getBotSession(String(ctx.from!.id));
    await clearSessionAndAbandon(String(ctx.from!.id), session?.applicationId);
    return ctx.reply(tr(lang, "cancelled"), { parse_mode: "Markdown" });
  }
  if (data === "submit_cancel_abort") {
    await clearInlineKeyboard(ctx);
    const session = await getBotSession(String(ctx.from!.id));
    if (session?.vacancyId) {
      const data2 = (session.collectedData as Record<string, unknown>) ?? {};
      await showReview(ctx, session.vacancyId, data2, lang);
    }
    return;
  }
}

// ---- /jobs ----
export async function handleJobs(ctx: Context) {
  return showJobs(ctx, null);
}

export async function showJobs(ctx: Context, departmentId: string | null) {
  const lang = await resolveBotLang(ctx);
  const activeVacancies = await db.select().from(vacancies)
    .where(and(eq(vacancies.status, "active"), eq(vacancies.isDemo, false), vacancyNotDeleted));

  if (!activeVacancies.length) {
    return ctx.reply(tr(lang, "no_jobs"), { parse_mode: "Markdown" });
  }

  if (departmentId === null) {
    // Show departments
    const deptRows = await db.select().from(departments).where(eq(departments.isActive, true));
    // Only show departments that have at least one active vacancy
    const activeDeptNames = new Set(activeVacancies.map((v) => normalizeDepartmentName(v.department)));
    const visibleDepts = deptRows.filter((d) => activeDeptNames.has(normalizeDepartmentName(d.name)));

    if (visibleDepts.length === 0) {
      // Fallback: show flat list if no departments
      const kb = new InlineKeyboard();
      for (const v of activeVacancies) {
        const salary = v.salaryMin > 0 && v.salaryMax > 0
          ? ` · $${Math.round(v.salaryMin / 1000)}k–$${Math.round(v.salaryMax / 1000)}k`
          : "";
        kb.text(`${v.title}${salary}`, `view_${v.id}`).row();
      }
      return ctx.reply(tr(lang, "jobs_header"), { reply_markup: kb, parse_mode: "Markdown" });
    }

    const kb = new InlineKeyboard();
    for (const d of visibleDepts) {
      kb.text(d.displayName, d.id).row();
    }
    if (ctx.callbackQuery?.message) {
      return ctx.editMessageText(tr(lang, "departments_header"), { reply_markup: kb, parse_mode: "Markdown" });
    }
    return ctx.reply(tr(lang, "departments_header"), { reply_markup: kb, parse_mode: "Markdown" });
  }

  // Show vacancies in selected department
  const deptRows = await db.select().from(departments).where(eq(departments.id, departmentId));
  const deptName = deptRows[0]?.name;
  const filtered = deptName
    ? activeVacancies.filter((v) => normalizeDepartmentName(v.department) === normalizeDepartmentName(deptName))
    : [];

  if (!filtered.length) {
    const kb = new InlineKeyboard().text(tr(lang, "btn_back_to_departments"), "browse_jobs");
    if (ctx.callbackQuery?.message) {
      return ctx.editMessageText(tr(lang, "dept_no_vacancies"), { reply_markup: kb, parse_mode: "Markdown" });
    }
    return ctx.reply(tr(lang, "dept_no_vacancies"), { reply_markup: kb, parse_mode: "Markdown" });
  }

  const kb = new InlineKeyboard();
  for (const v of filtered) {
    const salary = v.salaryMin > 0 && v.salaryMax > 0
      ? ` · $${Math.round(v.salaryMin / 1000)}k–$${Math.round(v.salaryMax / 1000)}k`
      : "";
    kb.text(`${v.title}${salary}`, `view_${v.id}`).row();
  }
  kb.row().text(tr(lang, "btn_back_to_departments"), "browse_jobs");
  if (ctx.callbackQuery?.message) {
    return ctx.editMessageText(tr(lang, "jobs_header"), { reply_markup: kb, parse_mode: "Markdown" });
  }
  return ctx.reply(tr(lang, "jobs_header"), { reply_markup: kb, parse_mode: "Markdown" });
}

function formatStatusDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusDisplay(
  lang: Lang,
  status: string,
  stage: { isFinal: boolean; isRejected: boolean } | null
): string {
  if (stage?.isRejected) {
    if (lang === "ru") return "🔴 Отклонено";
    if (lang === "en") return "🔴 Rejected";
    return "🔴 Rad etilgan";
  }
  if (stage?.isFinal) {
    if (lang === "ru") return "🟢 Принят";
    if (lang === "en") return "🟢 Hired";
    return "🟢 Qabul qilingan";
  }
  if (status === "submitted") {
    if (lang === "ru") return "🔵 На рассмотрении";
    if (lang === "en") return "🔵 In review";
    return "🔵 Ko'rib chiqilmoqda";
  }
  if (status === "in_progress") {
    if (lang === "ru") return "🟡 Заполняется";
    if (lang === "en") return "🟡 In progress";
    return "🟡 To'ldirilmoqda";
  }
  if (status === "abandoned") {
    if (lang === "ru") return "⚫ Остановлено";
    if (lang === "en") return "⚫ Abandoned";
    return "⚫ To'xtatilgan";
  }
  if (lang === "ru") return "⏳ Новая";
  if (lang === "en") return "⏳ New";
  return "⏳ Yangi";
}

// ---- /status ----
export async function handleStatus(ctx: Context) {
  const lang = await resolveBotLang(ctx);
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
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false), vacancyNotDeleted))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .where(eq(applications.candidateId, candRows[0].id));

  if (!appRows.length) return ctx.reply(tr(lang, "no_applications"), { parse_mode: "Markdown" });

  const lines = [tr(lang, "status_header"), ""];
  for (let i = 0; i < appRows.length; i++) {
    const { app, vacancy: v, stage } = appRows[i];
    lines.push(`*${i + 1}. ${v.title}*`);
    lines.push(`📅 ${formatStatusDate(app.appliedAt)}`);
    lines.push(`${statusDisplay(lang, app.status, stage)} · ${stage?.name ?? "—"}`);
    lines.push("");
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}

// ---- /help ----
export async function handleHelp(ctx: Context) {
  const lang = await resolveBotLang(ctx);
  await ctx.reply(tr(lang, "help_text"), { parse_mode: "Markdown" });
}

// ---- /cancel ----
export async function handleCancel(ctx: Context) {
  const lang = await resolveBotLang(ctx);
  const session = await getBotSession(String(ctx.from!.id));
  await clearSessionAndAbandon(String(ctx.from!.id), session?.applicationId);
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
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false), vacancyNotDeleted))
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
  const candidate = await getCandidateByTelegramId(telegramUserId);
  const lang = candidate ? candidateLang(candidate, await resolveBotLang(ctx)) : await resolveBotLang(ctx);

  if (session?.state === "awaiting_photo") {
    const photo = ctx.message?.photo;
    if (!photo || photo.length === 0 || !candidate) {
      return ctx.reply(tr(lang, "err_photo_required"), { parse_mode: "Markdown" });
    }
    const largest = photo[photo.length - 1];
    await setCandidatePhotoFileId({ candidateId: candidate.id, photoFileId: largest.file_id });
    const photoData = (session.collectedData as Record<string, unknown>) ?? {};
    return finishAnketa(ctx, candidate.id, lang, photoData);
  }

  if (session?.state === "awaiting_feedback_text") {
    return ctx.reply(tr(lang, "err_send_text"), { parse_mode: "Markdown" });
  }

  if (session?.state && session.state !== "complete") {
    // Photo during other active states — not expected
    return ctx.reply(tr(lang, "err_send_text"), { parse_mode: "Markdown" });
  }

  // Inbound persistence is handled by middleware, including attachment metadata.
}

// ---- text/document messages during application flow ----
export async function handleText(ctx: Context) {
  const lang = await resolveBotLang(ctx);
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);

  if (!session?.state || session.state === "complete") {
    return ctx.reply(tr(lang, "session_timeout"), { parse_mode: "Markdown" });
  }

  const text = ctx.message?.text?.trim() ?? "";

  if (session.state === "awaiting_contact_message") {
    const candidate = await getCandidateByTelegramId(telegramUserId);
    if (candidate && text) {
      await saveBotMessageRecord({
        candidateId: candidate.id,
        applicationId: null,
        direction: "inbound",
        text,
      });
    }
    await clearBotSession(telegramUserId);
    return ctx.reply(tr(lang, "contact_us_thanks"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_feedback_text") {
    const candidate = await getCandidateByTelegramId(telegramUserId);
    const kind = ((session.collectedData as Record<string, unknown> | null)?.feedbackKind ?? "general") as string;
    if (!text || text.length < 5) {
      return ctx.reply(tr(lang, "err_feedback_too_short"), { parse_mode: "Markdown" });
    }
    if (!candidate) {
      await clearBotSession(telegramUserId);
      return ctx.reply(tr(lang, "session_timeout"), { parse_mode: "Markdown" });
    }

    const [latestApplication] = await db
      .select({
        applicationId: applications.id,
        vacancyId: applications.vacancyId,
      })
      .from(applications)
      .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false), vacancyNotDeleted))
      .where(eq(applications.candidateId, candidate.id))
      .orderBy(desc(applications.lastActivityAt));

    await db.insert(feedback).values({
      id: `fb-${crypto.randomUUID()}`,
      source: "candidate",
      kind: kind === "complaint" || kind === "suggestion" ? kind : "general",
      status: "new",
      candidateId: candidate.id,
      applicationId: session.applicationId ?? latestApplication?.applicationId ?? null,
      vacancyId: session.vacancyId ?? latestApplication?.vacancyId ?? null,
      rating: null,
      comment: text,
      submittedAt: new Date(),
      updatedAt: new Date(),
    });
    await clearBotSession(telegramUserId);
    return ctx.reply(tr(lang, "feedback_thanks"), { parse_mode: "Markdown" });
  }

  const data = (session.collectedData as Record<string, unknown>) ?? {};
  const totalSteps = (data.totalSteps as number) ?? 6;

  if (ANKETA_STATES.has(session.state)) {
    return handleAnketaText(ctx, text, lang);
  }

  if (session.state === "awaiting_email_confirm") {
    return ctx.reply(tr(lang, "err_click_button"), { parse_mode: "Markdown" });
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
    if (text === "/skip") {
      // Email is optional — skip it
    } else if (!isValidEmail(text)) {
      return ctx.reply(tr(lang, "invalid_email"), { parse_mode: "Markdown" });
    } else {
      data.email = text;
    }
    return continueAfterEmail(ctx, session, data, lang);
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
      const portfolioStep = 3 + questions.length;
      await saveBotSession(telegramUserId, { state: "awaiting_portfolio", collectedData: data });
      await ctx.reply(
        `${tr(lang, "got_answer")}\n\n${tr(lang, "ask_portfolio", { step: portfolioStep, total: totalSteps })}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await saveBotSession(telegramUserId, { state: "awaiting_question", currentQuestionIndex: nextIdx, collectedData: data });
      await ctx.reply(tr(lang, "got_answer"), { parse_mode: "Markdown" });
      await askQuestion(ctx, questions[nextIdx], 3 + nextIdx, totalSteps, lang);
    }
    return;
  }

  if (session.state === "awaiting_portfolio") {
    const links = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const valid = links.filter((l) => /^https?:\/\//i.test(l));
    if (valid.length === 0) {
      return ctx.reply(tr(lang, "err_portfolio_min"), { parse_mode: "Markdown" });
    }
    data.portfolioLinks = valid;
    const motivationStep = totalSteps - 1;
    await saveBotSession(telegramUserId, { state: "awaiting_motivation", collectedData: data });
    return ctx.reply(tr(lang, "ask_motivation", { step: motivationStep, total: totalSteps }), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_motivation") {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 50) return ctx.reply(tr(lang, "err_motivation_short"), { parse_mode: "Markdown" });
    if (wordCount > 300) return ctx.reply(tr(lang, "err_motivation_long"), { parse_mode: "Markdown" });
    data.motivationLetter = text;
    await saveBotSession(telegramUserId, { state: "awaiting_consent", collectedData: data });
    const kb = new InlineKeyboard()
      .text(tr(lang, "consent_yes"), "consent_yes").row()
      .text(tr(lang, "consent_no"), "consent_no");
    return ctx.reply(tr(lang, "ask_consent"), { reply_markup: kb, parse_mode: "Markdown" });
  }
}

async function continueAfterEmail(
  ctx: Context,
  session: NonNullable<Awaited<ReturnType<typeof getBotSession>>>,
  data: Record<string, unknown>,
  lang: Lang
) {
  const telegramUserId = String(ctx.from!.id);
  const totalSteps = (data.totalSteps as number) ?? 6;
  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, session.vacancyId!))
    .orderBy(asc(screeningQuestions.orderIndex));

  if (questions.length === 0) {
    const portfolioStep = 3;
    await saveBotSession(telegramUserId, { state: "awaiting_portfolio", collectedData: data });
    await ctx.reply(tr(lang, "ask_portfolio", { step: portfolioStep, total: totalSteps }), { parse_mode: "Markdown" });
  } else {
    await saveBotSession(telegramUserId, { state: "awaiting_question", currentQuestionIndex: 0, collectedData: data });
    await askQuestion(ctx, questions[0], 3, totalSteps, lang);
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
  return createInProgressApplication({ candidateId, vacancyId });
}

async function startApplicationScreening(
  ctx: Context,
  vacancyId: string,
  lang: Lang,
  candidate: typeof candidates.$inferSelect | null,
  options: { forceReaskStable?: boolean } = {}
) {
  const telegramUserId = String(ctx.from!.id);
  const vacancy = await getLiveActiveVacancy(vacancyId);
  if (!vacancy) {
    await clearBotSession(telegramUserId);
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, vacancyId))
    .orderBy(asc(screeningQuestions.orderIndex));
  const totalSteps = 2 + questions.length + 3;

  const candidateId = ((ctx as any).state?.candidateId as string | undefined) ?? candidate?.id;
  let applicationId: string | undefined;
  if (candidateId) {
    const session = await getBotSession(telegramUserId);
    const browsingSourceId = session?.applicationId
      ? (await db
          .select({ sourceId: applications.sourceId })
          .from(applications)
          .where(eq(applications.id, session.applicationId)))[0]?.sourceId
      : null;
    applicationId = await createInProgressApplication({ candidateId, vacancyId, sourceId: browsingSourceId });
  }

  const existingName = options.forceReaskStable ? undefined : candidate?.fullName;
  const collectedData: Record<string, unknown> = { totalSteps };
  let startState: string = "awaiting_name";
  let resumeQuestionIdx = 0;

  if (existingName) {
    collectedData.fullName = existingName;
    const existingAnswers = applicationId
      ? await db.select().from(screeningAnswers).where(eq(screeningAnswers.applicationId, applicationId))
      : [];
    const answeredIds = new Set(existingAnswers.map((a) => a.questionId));
    const preloadedAnswers: Record<string, string> = {};
    for (const a of existingAnswers) preloadedAnswers[a.questionId] = a.answerText ?? "";
    collectedData.answers = preloadedAnswers;

    resumeQuestionIdx = questions.findIndex((q) => !answeredIds.has(q.id));
    if (resumeQuestionIdx === -1) resumeQuestionIdx = questions.length;

    if (resumeQuestionIdx >= questions.length) {
      startState = "awaiting_portfolio";
    } else {
      startState = resumeQuestionIdx > 0 ? "awaiting_question" : (candidateEmail(candidate) ? "awaiting_email_confirm" : "awaiting_email");
    }
  }

  await saveBotSession(telegramUserId, {
    vacancyId,
    applicationId: applicationId ?? null,
    state: startState,
    currentQuestionIndex: resumeQuestionIdx,
    collectedData,
  });

  if (existingName && startState !== "awaiting_email") {
    await ctx.reply(tr(lang, "resuming_application"), { parse_mode: "Markdown" });
  }

  if (startState === "awaiting_name") {
    await ctx.reply(tr(lang, "ask_name", { step: 1, total: totalSteps }), { parse_mode: "Markdown" });
  } else if (startState === "awaiting_email") {
    await ctx.reply(tr(lang, "ask_email", { step: 2, total: totalSteps }), { parse_mode: "Markdown" });
  } else if (startState === "awaiting_email_confirm") {
    const email = candidateEmail(candidate);
    const kb = new InlineKeyboard()
      .text(tr(lang, "btn_email_use_existing"), "email_use_existing").row()
      .text(tr(lang, "btn_email_enter_new"), "email_enter_new");
    await ctx.reply(tr(lang, "email_confirm", { email: email ?? "" }), { reply_markup: kb, parse_mode: "Markdown" });
  } else if (startState === "awaiting_question") {
    await askQuestion(ctx, questions[resumeQuestionIdx], 3 + resumeQuestionIdx, totalSteps, lang);
  } else if (startState === "awaiting_portfolio") {
    const portfolioStep = 3 + questions.length;
    await ctx.reply(tr(lang, "ask_portfolio", { step: portfolioStep, total: totalSteps }), { parse_mode: "Markdown" });
  }
}

async function startAnketa(ctx: Context, candidateId: string, fallbackLang: Lang, pendingVacancyId?: string) {
  const telegramUserId = String(ctx.from!.id);
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId));
  const lang = candidateLang(candidate, fallbackLang);

  if (candidate?.languagePref) {
    await saveBotSession(telegramUserId, {
      vacancyId: pendingVacancyId ?? null,
      applicationId: null,
      state: "awaiting_full_name",
      collectedData: { candidateId, pendingVacancyId: pendingVacancyId ?? null },
    });
    return ctx.reply(tr(lang, "ask_full_name"), { parse_mode: "Markdown" });
  }

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

  await ctx.reply(tr(lang, "welcome_dual"), { parse_mode: "Markdown" });
  await ctx.reply(tr(lang, "ask_language"), { reply_markup: kb, parse_mode: "Markdown" });
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
    if (isStudent) {
      await saveBotSession(telegramUserId, { state: "awaiting_education_institution", collectedData: sessionData });
      return ctx.reply(tr(lang, "ask_institution"), { parse_mode: "Markdown" });
    } else {
      await saveBotSession(telegramUserId, { state: "awaiting_education_field", collectedData: sessionData });
      return ctx.reply(tr(lang, "ask_education"), { parse_mode: "Markdown" });
    }
  }

  if (data.startsWith("anketa_study_form_") && session.state === "awaiting_study_form") {
    const form = data.replace("anketa_study_form_", "");
    await db.update(candidates)
      .set({ studyForm: form })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_study_year", collectedData: sessionData });
    return askStudyYear(ctx, lang);
  }

  if (data.startsWith("anketa_study_year_") && session.state === "awaiting_study_year") {
    const year = data.replace("anketa_study_year_", "");
    await db.update(candidates)
      .set({ studyYear: year })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_english_level", collectedData: sessionData });
    return askLanguageLevel(ctx, "english", lang);
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
    await saveBotSession(telegramUserId, { state: "awaiting_photo", collectedData: sessionData });
    return ctx.reply(tr(lang, "ask_photo"), { parse_mode: "Markdown" });
  }

  if (data === "anketa_work_more_yes") {
    sessionData.pendingExp = {};
    await saveBotSession(telegramUserId, { state: "awaiting_work_company", collectedData: sessionData });
    return askWorkCompany(ctx, lang);
  }

  if (data === "anketa_work_more_no") {
    await saveBotSession(telegramUserId, { state: "awaiting_photo", collectedData: sessionData });
    return ctx.reply(tr(lang, "ask_photo"), { parse_mode: "Markdown" });
  }
}

export async function handleContact(ctx: Context) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);
  if (session?.state !== "awaiting_phone") return handleText(ctx);

  const candidate = await getCandidateByTelegramId(telegramUserId);
  if (!candidate) return;

  const lang = candidateLang(candidate, await resolveBotLang(ctx));
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
    const dobResult = parseDob(text);
    if ("error" in dobResult) {
      const key = dobResult.error === "age" ? "err_dob_age" : "err_dob_format";
      return ctx.reply(tr(lang, key), { parse_mode: "Markdown" });
    }
    await db.update(candidates)
      .set({ dateOfBirth: dobResult.date })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_address", collectedData: data });
    return ctx.reply(tr(lang, "ask_address"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_address") {
    await db.update(candidates)
      .set({ address: text, city: text })
      .where(eq(candidates.id, candidate.id));

    const existingPhone = candidate.phone?.trim();
    if (existingPhone) {
      const kb = new InlineKeyboard()
        .text(tr(lang, "btn_use_existing_phone"), "phone_use_existing").row()
        .text(tr(lang, "btn_enter_new_phone"), "phone_enter_new");
      await saveBotSession(telegramUserId, { state: "awaiting_phone_confirm", collectedData: data });
      return ctx.reply(tr(lang, "confirm_existing_phone", { phone: existingPhone }), { reply_markup: kb, parse_mode: "Markdown" });
    }

    await saveBotSession(telegramUserId, { state: "awaiting_phone", collectedData: data });
    return askPhone(ctx, lang);
  }

  if (session.state === "awaiting_phone") {
    const phoneRaw = text === "/skip" ? null : text.replace(/\s+/g, "");
    if (phoneRaw !== null) {
      const normalized = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;
      if (!/^\+\d{9,15}$/.test(normalized)) {
        return ctx.reply(tr(lang, "err_phone_format"), { parse_mode: "Markdown" });
      }
      await db.update(candidates).set({ phone: normalized }).where(eq(candidates.id, candidate.id));
    }
    await saveBotSession(telegramUserId, { state: "awaiting_marital_status", collectedData: data });
    return askMarital(ctx, lang);
  }

  if (session.state === "awaiting_education_institution") {
    await db.update(candidates)
      .set({ educationInstitution: text })
      .where(eq(candidates.id, candidate.id));
    await saveBotSession(telegramUserId, { state: "awaiting_education_field", collectedData: data });
    return ctx.reply(tr(lang, "ask_education"), { parse_mode: "Markdown" });
  }

  if (session.state === "awaiting_education_field") {
    await db.update(candidates)
      .set({ educationField: text })
      .where(eq(candidates.id, candidate.id));
    // If student, ask study form next; otherwise go straight to english level
    const candForStudent = await getCandidateByTelegramId(telegramUserId);
    if (candForStudent?.isStudent) {
      await saveBotSession(telegramUserId, { state: "awaiting_study_form", collectedData: data });
      return askStudyForm(ctx, lang);
    }
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

  if (session.state === "awaiting_photo") {
    return ctx.reply(tr(lang, "err_photo_required"), { parse_mode: "Markdown" });
  }

  // B5: States that are button-only — text input is not expected here
  const buttonOnlyStates = new Set([
    "awaiting_lang_pref",
    "awaiting_department",
    "awaiting_marital_status",
    "awaiting_student_status",
    "awaiting_study_form",
    "awaiting_study_year",
    "awaiting_english_level",
    "awaiting_russian_level",
  ]);
  if (session.state && buttonOnlyStates.has(session.state)) {
    return ctx.reply(tr(lang, "err_click_button"), { parse_mode: "Markdown" });
  }
}

async function askDepartment(ctx: Context, lang: Lang) {
  const rows = await getBotVisibleDepartments();

  if (rows.length === 0) {
    // No departments configured — end the flow gracefully instead of leaving user stuck
    await clearSessionAndAbandon(String(ctx.from!.id), null);
    await ctx.reply(tr(lang, "back_later"), { parse_mode: "Markdown" });
    return;
  }

  const kb = new InlineKeyboard();
  for (const department of rows) {
    kb.text(department.displayName, `anketa_department_${department.id}`).row();
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

async function askStudyForm(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "study_daytime"), "anketa_study_form_daytime")
    .text(tr(lang, "study_evening"), "anketa_study_form_evening").row()
    .text(tr(lang, "study_correspondence"), "anketa_study_form_correspondence")
    .text(tr(lang, "study_online"), "anketa_study_form_online");
  await ctx.reply(tr(lang, "ask_study_form"), { reply_markup: kb, parse_mode: "Markdown" });
}

async function askStudyYear(ctx: Context, lang: Lang) {
  const kb = new InlineKeyboard()
    .text(tr(lang, "study_year_1"), "anketa_study_year_1")
    .text(tr(lang, "study_year_2"), "anketa_study_year_2")
    .text(tr(lang, "study_year_3"), "anketa_study_year_3").row()
    .text(tr(lang, "study_year_4"), "anketa_study_year_4")
    .text(tr(lang, "study_year_5"), "anketa_study_year_5")
    .text(tr(lang, "study_year_6"), "anketa_study_year_6").row()
    .text(tr(lang, "study_year_masters"), "anketa_study_year_masters").row()
    .text(tr(lang, "study_year_phd"), "anketa_study_year_phd").row()
    .text(tr(lang, "study_year_graduated"), "anketa_study_year_graduated");
  await ctx.reply(tr(lang, "ask_study_year"), { reply_markup: kb, parse_mode: "Markdown" });
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
  await clearSessionAndAbandon(telegramUserId, null);
  await ctx.reply(tr(lang, "profile_complete"), { parse_mode: "Markdown" });

  const pendingVacancyId = typeof data.pendingVacancyId === "string" ? data.pendingVacancyId : null;
  if (pendingVacancyId) {
    await startVacancyFlow(ctx, pendingVacancyId, lang);
  } else {
    // B9: Route to jobs filtered by the candidate's chosen department
    const candRows = await db.select().from(candidates).where(eq(candidates.id, candidateId));
    const departmentId = candRows[0]?.departmentId ?? null;
    await showJobs(ctx, departmentId);
  }
}

function isLanguageLevel(value: string): value is "none" | "a1_a2" | "b1_b2" | "c1_c2" | "native" {
  return ["none", "a1_a2", "b1_b2", "c1_c2", "native"].includes(value);
}

type DobResult = { date: Date } | { error: "format" | "age" };

function parseDob(value: string): DobResult {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return { error: "format" };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { error: "format" };
  }

  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;

  return age >= 14 && age <= 99 ? { date } : { error: "age" };
}

// B27: Handle qans_<index> callback for single-choice screening questions
async function handleQansCallback(ctx: Context, data: string, lang: Lang) {
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);
  if (!session || session.state !== "awaiting_question") return;

  const optionIndex = Number(data.replace("qans_", ""));
  const qIdx = session.currentQuestionIndex ?? 0;
  const collectedData = ((session.collectedData as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const totalSteps = (collectedData.totalSteps as number) ?? 6;

  const questions = await db.select().from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, session.vacancyId!))
    .orderBy(asc(screeningQuestions.orderIndex));

  const q = questions[qIdx];
  if (!q) return;

  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
  const answerText = opts[optionIndex] ?? String(optionIndex);

  const answers = ((collectedData.answers as Record<string, string>) ?? {});
  answers[q.id] = answerText;
  collectedData.answers = answers;

  const applicationId = (session as any).applicationId as string | undefined;
  if (applicationId) {
    await saveScreeningAnswerLive({ applicationId, questionId: q.id, answerText }).catch((err) => {
      console.error("[handleQansCallback] saveScreeningAnswerLive failed:", err);
    });
  }

  const nextIdx = qIdx + 1;
  if (nextIdx >= questions.length) {
    const portfolioStep = 3 + questions.length;
    await saveBotSession(telegramUserId, { state: "awaiting_portfolio", collectedData });
    await ctx.reply(
      `${tr(lang, "got_answer")}\n\n${tr(lang, "ask_portfolio", { step: portfolioStep, total: totalSteps })}`,
      { parse_mode: "Markdown" }
    );
  } else {
    await saveBotSession(telegramUserId, { state: "awaiting_question", currentQuestionIndex: nextIdx, collectedData });
    await ctx.reply(tr(lang, "got_answer"), { parse_mode: "Markdown" });
    await askQuestion(ctx, questions[nextIdx], 3 + nextIdx, totalSteps, lang);
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
  const vacancy = await getLiveActiveVacancy(vacancyId);

  if (!vacancy) {
    await clearBotSession(String(ctx.from!.id));
    return ctx.reply(tr(lang, "vacancy_not_found"), { parse_mode: "Markdown" });
  }

  const telegramUserId = String(ctx.from!.id);
  const candidate = await getCandidateByTelegramId(telegramUserId);
  const hasPhoto = !!candidate?.photoFileId;
  const portfolioLinks = Array.isArray(data.portfolioLinks) ? (data.portfolioLinks as string[]) : [];
  const motivationText = data.motivationLetter ? String(data.motivationLetter) : "";
  const motivationExcerpt = motivationText.length > 150
    ? `${motivationText.slice(0, 150)}…`
    : motivationText;

  const lines = [
    tr(lang, "review_header"),
    tr(lang, "review_name", { value: String(data.fullName ?? "—") }),
    tr(lang, "review_email", { value: String(data.email ?? "—") }),
    tr(lang, "review_position", { value: vacancy.title }),
    `📸 Photo: ${hasPhoto ? "✅" : "—"}`,
    `🔗 Portfolio: ${portfolioLinks.length} link(s)`,
    motivationExcerpt ? `✍️ ${motivationExcerpt}` : "",
    `✅ Consent: given`,
  ].filter(Boolean);

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
        motivationLetter: data.motivationLetter ? String(data.motivationLetter) : undefined,
        portfolioLinks: Array.isArray(data.portfolioLinks) ? (data.portfolioLinks as string[]) : undefined,
      });
      await submitApplication(existingApplicationId, { notifyCandidate: false });
      appId = existingApplicationId;
    } else {
      // Backward-compat path: no in_progress application (e.g. old session without applicationId)
      // Telegram has no data-mode cookie: bot-created candidates/applications are Live-only.
      const candidateId = (ctx as any).state?.candidateId as string | undefined;
      if (candidateId) {
        const liveAppId = await createInProgressApplication({ candidateId, vacancyId: session.vacancyId! });
        const answers = (data.answers as Record<string, string>) ?? {};
        for (const [questionId, answerText] of Object.entries(answers)) {
          if (!answerText) continue;
          await saveScreeningAnswerLive({ applicationId: liveAppId, questionId, answerText });
        }
        await finalizeApplicationDetails({
          applicationId: liveAppId,
          fullName: String(data.fullName ?? ctx.from!.first_name),
          email: data.email ? String(data.email) : undefined,
          motivationLetter: data.motivationLetter ? String(data.motivationLetter) : undefined,
          portfolioLinks: Array.isArray(data.portfolioLinks) ? (data.portfolioLinks as string[]) : undefined,
        });
        await submitApplication(liveAppId, { notifyCandidate: false });
        appId = liveAppId;
      } else {
        appId = await createApplicationFromBot({
          telegramUserId,
          telegramUsername: ctx.from!.username,
          telegramFirstName: ctx.from!.first_name,
          fullName: String(data.fullName ?? ctx.from!.first_name),
          email: data.email ? String(data.email) : undefined,
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

  const telegramUserId = String(ctx.from!.id);
  const candidate = await getCandidateByTelegramId(telegramUserId);
  const hasPhoto = !!candidate?.photoFileId;
  const portfolioLinks = Array.isArray(data.portfolioLinks) ? (data.portfolioLinks as string[]) : [];
  const motivationText = data.motivationLetter ? String(data.motivationLetter) : "";
  const motivationExcerpt = motivationText.slice(0, 150);
  const consentedAt = candidate?.consentedAt ? new Date(candidate.consentedAt).toISOString() : null;

  const text = [
    `🔔 *New application — ${vacancyTitle}*`,
    `👤 ${data.fullName ?? "—"} (@${ctx.from?.username ?? "no username"})`,
    `📧 ${data.email ?? "—"}`,
    `📸 Photo: ${hasPhoto ? "biriktirilgan ✅" : "yo'q"}`,
    `🔗 Portfolio: ${portfolioLinks.length} ta link`,
    motivationExcerpt ? `✍️ ${motivationExcerpt}…` : "",
    consentedAt ? `✅ Consent: ${consentedAt}` : "⚠️ Consent: not recorded",
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

// ---- /reset (admin only — for HR testing) ----
export async function handleReset(ctx: Context) {
  const lang = await resolveBotLang(ctx);
  const telegramUserId = String(ctx.from!.id);
  const adminIds = (process.env.BOT_ADMIN_TELEGRAM_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!adminIds.includes(telegramUserId)) {
    return ctx.reply("Unauthorized", { parse_mode: "Markdown" });
  }
  const [cand] = await db.select().from(candidates).where(eq(candidates.telegramUserId, telegramUserId));
  if (!cand) return ctx.reply("No data to reset.", { parse_mode: "Markdown" });
  await db.delete(applications).where(eq(applications.candidateId, cand.id));
  await db.update(candidates)
    .set({ profileCompleted: false })
    .where(eq(candidates.id, cand.id));
  await clearBotSession(telegramUserId);
  return ctx.reply("✅ Reset complete. /start to test again.", { parse_mode: "Markdown" });
}

// ---- /testreset (admin only — wipes applications but keeps profile) ----
export async function handleTestReset(ctx: Context) {
  const lang = await resolveBotLang(ctx);
  const telegramUserId = String(ctx.from!.id);
  const adminIds = (process.env.BOT_ADMIN_TELEGRAM_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!adminIds.includes(telegramUserId)) {
    return ctx.reply("Unauthorized", { parse_mode: "Markdown" });
  }
  const [cand] = await db.select().from(candidates).where(eq(candidates.telegramUserId, telegramUserId));
  if (!cand) return ctx.reply("No data to reset.", { parse_mode: "Markdown" });
  await db.delete(applications).where(eq(applications.candidateId, cand.id));
  await clearBotSession(telegramUserId);
  return ctx.reply("✅ Applications cleared. Profile kept. /start to test again.", { parse_mode: "Markdown" });
}

// ---- /back ----
export async function handleBack(ctx: Context) {
  const lang = await resolveBotLang(ctx);
  const telegramUserId = String(ctx.from!.id);
  const session = await getBotSession(telegramUserId);

  if (!session || session.state === "complete") {
    // No active session — show main menu
    return handleStart(ctx);
  }

  // Re-prompt current step based on state
  if (session.state === "awaiting_question" && session.vacancyId) {
    const questions = await db.select().from(screeningQuestions)
      .where(eq(screeningQuestions.vacancyId, session.vacancyId))
      .orderBy(asc(screeningQuestions.orderIndex));
    const qIdx = session.currentQuestionIndex ?? 0;
    const q = questions[qIdx];
    const totalSteps = ((session.collectedData as Record<string, unknown>)?.totalSteps as number) ?? 6;
    if (q) {
      return askQuestion(ctx, q, 3 + qIdx, totalSteps, lang);
    }
  }

  // For all other states, re-send the current prompt
  return ctx.reply(tr(lang, "session_timeout"), { parse_mode: "Markdown" });
}
