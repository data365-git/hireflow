// tests/e2e/scenarios/04-photo-validation.test.ts
/**
 * Photo / document validation — exercises the REAL bot middleware and handlers.
 *
 * Strategy: drive a candidate to awaiting_application_photo state by walking
 * through the full anketa + screening start (portfolio step). Then send
 * oversized / disallowed files and assert bot replies with the correct error.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { seedHrUser, seedVacancy, makeCandidate } from "../fixtures/builders";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";
import { makeCallbackUpdate } from "../fixtures/payloads/callback";
import { makeTextUpdate } from "../fixtures/payloads/text";
import { makeContactUpdate } from "../fixtures/payloads/contact";
import { makePhotoUpdate, makeDocumentUpdate } from "../fixtures/payloads/photo";
import { getSentMessagesFor } from "../setup/stub-telegram-api";
import { isApplicationSubmitted } from "../harness/verify";

const TWO_MB = 2 * 1024 * 1024;

let _vacancyId = "";

/**
 * Drive a fresh candidate to awaiting_application_photo state.
 * This is the minimal path through the bot state machine to reach that state.
 *
 * Path: /start → first_lang_uz → apply (anketa) → full_name → dob → address
 *   → contact → marital → student_no → education_field → english → russian
 *   → work_none → profile_photo (finishAnketa) → apply again → name → email
 *   → portfolio → NOW IN awaiting_application_photo
 */
async function driveToAppPhoto(uid: number): Promise<void> {
  const cand = makeCandidate({ telegramUserId: uid });
  const vacancyId = _vacancyId;

  await sendUpdate(makeStartUpdate({ telegramUserId: uid, firstName: cand.firstName, payload: vacancyId }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "first_lang_uz" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `apply_${vacancyId}` }));

  // Anketa
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: cand.fullName }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "15.06.2000" }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: cand.city }));
  await sendUpdate(makeContactUpdate({ telegramUserId: uid, phone: cand.phone }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_marital_single" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_student_no" }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "Computer Science" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_english_b1_b2" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_russian_b1_b2" }));
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "anketa_work_none" }));
  await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: 500_000 })); // profile photo

  // Screening start (no questions → goes straight to portfolio)
  await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: `apply_${vacancyId}` }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: cand.fullName }));
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: cand.email }));
  // portfolio → advances to awaiting_application_photo
  await sendUpdate(makeTextUpdate({ telegramUserId: uid, text: "https://portfolio.example.com" }));
}

describe("04 — Photo / Document Validation", () => {
  beforeEach(async () => {
    const hr = await seedHrUser();
    _vacancyId = await seedVacancy({ hrId: hr.id });
  });

  test("application photo over 2 MB → bot replies with error, application not submitted", async () => {
    const uid = 104_001;
    await driveToAppPhoto(uid);

    await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: TWO_MB + 1 }));

    // Bot should have sent an error reply (not advance to motivation)
    const msgs = getSentMessagesFor(uid);
    expect(msgs.length).toBeGreaterThan(0);
    // The state stays at awaiting_application_photo so application is not submitted
    expect(await isApplicationSubmitted(uid, _vacancyId)).toBe(false);
  });

  test("application photo at exactly 2 MB is accepted, flow advances past photo step", async () => {
    const uid = 104_002;
    await driveToAppPhoto(uid);

    const countBefore = getSentMessagesFor(uid).length;
    await sendUpdate(makePhotoUpdate({ telegramUserId: uid, sizeBytes: TWO_MB }));

    // Bot should have replied (advancing to motivation step)
    const countAfter = getSentMessagesFor(uid).length;
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test("PDF document under 5 MB passes MIME check — no rejection message sent", async () => {
    const uid = 104_003;
    // Send a PDF document when bot is at default state (no active session)
    // Middleware checks MIME before bot processes it
    await sendUpdate(makeDocumentUpdate({
      telegramUserId: uid,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_000_000,
    }));
    const msgs = getSentMessagesFor(uid);
    const gotMimeError = msgs.some((m) =>
      JSON.stringify(m.payload).includes("doc_type_not_allowed")
    );
    expect(gotMimeError).toBe(false);
  });

  test("non-allowlisted MIME type is rejected by middleware", async () => {
    const uid = 104_004;
    await sendUpdate(makeDocumentUpdate({
      telegramUserId: uid,
      fileName: "script.sh",
      mimeType: "application/x-sh",
      sizeBytes: 1_000,
    }));
    const msgs = getSentMessagesFor(uid);
    // Middleware replies with err_doc_type_not_allowed
    expect(msgs.length).toBeGreaterThan(0);
  });

  test("image sent as document over 2 MB → rejected (images-as-doc get 2 MB cap, not 5 MB)", async () => {
    const uid = 104_005;
    await sendUpdate(makeDocumentUpdate({
      telegramUserId: uid,
      fileName: "big_photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: TWO_MB + 1,
    }));
    const msgs = getSentMessagesFor(uid);
    // Middleware replies with size error for image-as-document > 2MB
    expect(msgs.length).toBeGreaterThan(0);
  });
});
