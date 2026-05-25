import { sendUpdate } from "./send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";
import { makeCallbackUpdate } from "../fixtures/payloads/callback";
import { makeTextUpdate } from "../fixtures/payloads/text";
import { makeContactUpdate } from "../fixtures/payloads/contact";
import { makePhotoUpdate } from "../fixtures/payloads/photo";
import type { CandidateProfile } from "../fixtures/builders";

export type DriveFlowOptions = {
  vacancyId: string;
  sourceId?: string;
  candidate: CandidateProfile;
  lang?: "uz" | "ru" | "en";
  /** If true, stop after browsing (don't apply) */
  browseOnly?: boolean;
  /** Override number of screening questions to answer */
  questionCount?: number;
};

/**
 * Drives a brand-new candidate (no prior DB record) through the full bot flow:
 *   /start → language pick → anketa (profile completion) → vacancy view → apply
 *   → name/email → screening questions → portfolio → photo → motivation → consent → submit
 *
 * The anketa sequence follows the ANKETA_STATES machine in lib/bot/handlers.ts exactly.
 * Because the candidate is new (no languagePref), the bot first asks for language via
 * first_lang_* callback, which sets languagePref and triggers startVacancyFlow.
 * apply_<vacancyId> then detects profileCompleted=false and routes into startAnketa.
 * Since languagePref is already set, startAnketa begins at awaiting_full_name (not awaiting_lang_pref).
 */
export async function driveFullApplication(opts: DriveFlowOptions): Promise<void> {
  const { vacancyId, sourceId, candidate, lang = "uz" } = opts;
  const uid = candidate.telegramUserId;
  const payload = sourceId ? `${vacancyId}_${sourceId}` : vacancyId;

  // 1. /start with vacancy payload — bot sees no languagePref, calls askFirstLanguage
  await sendUpdate(makeStartUpdate({ telegramUserId: uid, firstName: candidate.firstName, payload }));

  // 2. Pick language — bot creates candidate record with languagePref set, then calls startVacancyFlow
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `first_lang_${lang}` }));

  if (opts.browseOnly) return;

  // 3. Click Apply — candidate has no profileCompleted, so bot starts anketa at awaiting_full_name
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `apply_${vacancyId}` }));

  // ── Anketa: profile completion ──────────────────────────────────────────────
  // State: awaiting_full_name
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.fullName }));

  // State: awaiting_dob — expects DD.MM.YYYY format
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "15.06.2000" }));

  // State: awaiting_address
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.city }));

  // State: awaiting_phone (no existing phone on new candidate, so bot skips awaiting_phone_confirm)
  // Contact update triggers handleContact → saves phone → awaiting_marital_status
  await sendUpdate(makeContactUpdate({ telegramUserId: uid, phone: candidate.phone }));

  // State: awaiting_marital_status — button-only
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_marital_single" }));

  // State: awaiting_student_status — button-only
  // Choosing "no student" skips institution/study_form/study_year and goes to awaiting_education_field
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_student_no" }));

  // State: awaiting_education_field (non-student path: no awaiting_education_institution)
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "Computer Science" }));

  // State: awaiting_english_level — button-only
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_english_b1_b2" }));

  // State: awaiting_russian_level — button-only
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_russian_b1_b2" }));

  // State: awaiting_work_company — send "no experience" callback
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_work_none" }));

  // State: awaiting_photo — send a profile photo to finish anketa
  // finishAnketa marks profileCompleted=true, clears session, then calls startVacancyFlow again
  await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: candidate.photoSizeBytes ?? 500_000 }));

  // ── Application screening ────────────────────────────────────────────────────
  // After finishAnketa, startVacancyFlow shows the vacancy detail again.
  // Click Apply again — now profileCompleted=true, so bot goes to startApplicationScreening
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `apply_${vacancyId}` }));

  // State: awaiting_name
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.fullName }));

  // State: awaiting_email
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.email }));

  // State: awaiting_question (one per screening question)
  const qCount = opts.questionCount ?? (candidate.answers?.length ?? 0);
  for (let i = 0; i < qCount; i++) {
    const answer = candidate.answers?.[i] ?? `Answer ${i + 1}`;
    await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: answer }));
  }

  // State: awaiting_portfolio — one or more https:// links, newline-separated
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.portfolioLinks.join("\n") }));

  // State: awaiting_application_photo
  await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: candidate.photoSizeBytes ?? 500_000 }));

  // State: awaiting_motivation — must be 50–300 words
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.motivation }));

  // State: awaiting_consent — consent_yes moves to awaiting_review and shows review
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "consent_yes" }));

  // State: awaiting_review — submit_confirm triggers handleSubmitConfirm → submits application
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "submit_confirm" }));
}
