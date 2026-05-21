/**
 * Stage-aware candidate notifications via Telegram.
 * Called from moveApplicationToStage in app/actions/applications.ts.
 */
import { Bot } from "grammy";
import { db } from "@/lib/db/client";
import { applications, candidates, vacancies, vacancyStages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { tr, type Lang } from "./i18n";

type StageKind = "intake" | "screening" | "interview" | "test" | "hired" | "rejected" | "reserve" | "other";

function classifyStageKind(stage: { name: string; color: string; isFinal: boolean; isRejected: boolean; isReserve: boolean; orderIndex: number }): StageKind {
  if (stage.isRejected) return "rejected";
  if (stage.isReserve) return "reserve";
  if (stage.orderIndex === 0) return "intake";

  const name = stage.name.toLowerCase();
  if (/screen|review|анкет|скрин|ko.?rib/i.test(name)) return "screening";
  if (/interview|собесед|suhbat|интервью/i.test(name)) return "interview";
  if (/test|задани|topshir|тест/i.test(name)) return "test";
  if (/hire|offer|принят|qabul|нанят/i.test(name)) return "hired";
  if (/reserv|резерв/i.test(name)) return "reserve";

  return "other";
}

function iKeyForKind(kind: StageKind): string {
  return `stage_${kind}`;
}

export async function sendStageNotification(params: {
  applicationId: string;
  toStageId: string;
  comment?: string | null;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const { applicationId, toStageId, comment } = params;

  // Fetch application + candidate + vacancy + target stage in one query
  const rows = await db
    .select({
      candidateName: candidates.fullName,
      telegramUserId: candidates.telegramUserId,
      languagePref: candidates.languagePref,
      language: candidates.language,
      vacancyTitle: vacancies.title,
      stageName: vacancyStages.name,
      stageColor: vacancyStages.color,
      isFinal: vacancyStages.isFinal,
      isRejected: vacancyStages.isRejected,
      isReserve: vacancyStages.isReserve,
      orderIndex: vacancyStages.orderIndex,
    })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false)))
    .innerJoin(vacancyStages, eq(vacancyStages.id, toStageId))
    .where(eq(applications.id, applicationId));

  const row = rows[0];
  if (!row?.telegramUserId) return; // candidate not linked to Telegram

  const lang: Lang = (row.languagePref ?? row.language) === "ru" ? "ru"
    : (row.languagePref ?? row.language) === "en" ? "en"
    : "uz";

  const kind = classifyStageKind({
    name: row.stageName,
    color: row.stageColor,
    isFinal: row.isFinal,
    isRejected: row.isRejected,
    isReserve: row.isReserve,
    orderIndex: row.orderIndex,
  });

  const key = iKeyForKind(kind);
  let text = tr(lang, key, {
    name: row.candidateName ?? "",
    vacancy: row.vacancyTitle,
    stage: row.stageName,
  });

  // Append HR comment for stages where context matters
  if (comment?.trim() && (kind === "interview" || kind === "test" || kind === "rejected")) {
    text = `${text}\n\n${comment.trim()}`;
  }

  try {
    const bot = new Bot(botToken);
    await bot.api.sendMessage(row.telegramUserId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[notifications] sendStageNotification failed:", err);
  }
}
