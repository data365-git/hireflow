// tests/e2e/harness/drive-flow.ts
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
  /** Stop after /start + language pick (browsing row created, not applied) */
  browseOnly?: boolean;
  /**
   * Number of screening questions the vacancy has. Defaults to
   * candidate.answers.length. Pass 0 explicitly when the vacancy
   * was seeded with no questions.
   */
  questionCount?: number;
};

/**
 * Drives a brand-new candidate through the full bot state machine:
 *   /start → language pick → [vacancy view] → apply
 *   → name/email → (screening questions) → portfolio → app_photo → motivation → consent → submit
 *
 * State machine notes (from lib/bot/handlers.ts):
 *   - startAnketa() at line 1246: if languagePref is already set (set by first_lang_*),
 *     the anketa starts at awaiting_full_name and SKIPS awaiting_department.
 *     The department step only fires when the candidate has no languagePref yet
 *     and goes through awaiting_lang_pref → awaiting_department.
 *   - Motivation: enforces ≥50 words at handlers.ts:1102. builders.ts provides
 *     a compliant default (see makeCandidate).
 */
export async function driveFullApplication(opts: DriveFlowOptions): Promise<void> {
  const { vacancyId, sourceId, candidate, lang = "uz" } = opts;
  const uid = candidate.telegramUserId;
  const payload = sourceId ? `${vacancyId}_${sourceId}` : vacancyId;

  // 1. /start → bot sees no languagePref, calls askFirstLanguage → awaiting_first_lang
  await sendUpdate(makeStartUpdate({ telegramUserId: uid, firstName: candidate.firstName, payload }));

  // 2. Language pick → sets languagePref, calls startVacancyFlow → shows vacancy card
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `first_lang_${lang}` }));

  if (opts.browseOnly) return;

  // 3. Apply → profileCompleted=false → startAnketa → awaiting_full_name
  //    (startAnketa skips awaiting_department because languagePref is already set)
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `apply_${vacancyId}` }));

  // ── Anketa (profile completion) ──────────────────────────────────────────
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.fullName }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "15.06.2000" })); // DOB DD.MM.YYYY
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.city }));
  // Contact → awaiting_marital_status (no existing phone on new candidate)
  await sendUpdate(makeContactUpdate({ telegramUserId: uid, phone: candidate.phone }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_marital_single" }));
  // Student: "no" → skips institution/study_form/study_year → awaiting_education_field
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_student_no" }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "Computer Science" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_english_b1_b2" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_russian_b1_b2" }));
  // Work experience: "none" → skips company/position/period/leave → finishes anketa work section
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_work_none" }));
  // Profile photo → finishAnketa → profileCompleted=true → startVacancyFlow
  await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: candidate.photoSizeBytes ?? 500_000 }));

  // ── Application screening ─────────────────────────────────────────────────
  // Re-click Apply — now profileCompleted=true → startApplicationScreening
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `apply_${vacancyId}` }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.fullName }));  // awaiting_name
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.email }));      // awaiting_email

  const qCount = opts.questionCount ?? (candidate.answers?.length ?? 0);
  for (let i = 0; i < qCount; i++) {
    await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.answers?.[i] ?? `Answer ${i + 1}` }));
  }

  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.portfolioLinks.join("\n") }));
  await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: candidate.photoSizeBytes ?? 500_000 }));
  // Motivation: ≥50 words required. makeCandidate() provides a compliant default.
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: candidate.motivation }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "consent_yes" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "submit_confirm" }));
}
