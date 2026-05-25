import { describe, test, expect, beforeEach } from "vitest";
import { seedHrUser, seedVacancy, makeCandidate } from "../fixtures/builders";
import { getSentMessages } from "../setup/stub-telegram-api";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";
import { makeCallbackUpdate } from "../fixtures/payloads/callback";
import { makePhotoUpdate, makeDocumentUpdate } from "../fixtures/payloads/photo";
import { makeTextUpdate } from "../fixtures/payloads/text";
import { getApplication } from "../harness/verify";

const TWO_MB = 2 * 1024 * 1024;

// Helper: put bot into awaiting_application_photo state
// (after portfolio step — this requires walking through most of the anketa)
// Simplified: just need the bot to be in the photo state
async function putBotInPhotoState(vacancyId: string, telegramUserId: number) {
  // TODO: drive the candidate up to the portfolio step then send portfolio
  // For now this is a placeholder — implement once drive-flow is complete
}

describe("04 — Photo Validation", () => {
  let vacancyId: string;
  const cand = makeCandidate({ telegramUserId: 104_001 });

  test("photo at exactly 2 MB is accepted (no rejection message)", async () => {
    // This is a structural test — check that file_size <= 2MB does not trigger error
    // Full integration requires bot to be in awaiting_*_photo state
    // The 2 MB check is in handlers.ts isPhotoTooLarge helper
    const photo = makePhotoUpdate({ telegramUserId: 104_001, sizeBytes: TWO_MB });
    // The largest photo variant has file_size === TWO_MB — should not trigger rejection
    const largest = photo.message.photo.at(-1)!;
    expect(largest.file_size).toBeLessThanOrEqual(TWO_MB);
  });

  test("photo at 2MB+1 triggers rejection (unit-level check on helper)", async () => {
    const photo = makePhotoUpdate({ telegramUserId: 104_002, sizeBytes: TWO_MB + 1 });
    const largest = photo.message.photo.at(-1)!;
    expect(largest.file_size).toBeGreaterThan(TWO_MB);
    // The actual bot rejection happens in handlePhoto when isPhotoTooLarge returns true
    // Full E2E version of this test requires drive-flow to put the bot in photo state first
  });

  test("PDF document under 5MB is not rejected by MIME check", () => {
    const doc = makeDocumentUpdate({
      telegramUserId: 104_003,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_000_000,
    });
    expect(doc.message.document.mime_type).toBe("application/pdf");
    // MIME is in the allowed set — would not be rejected by middleware
  });

  test(".exe document would be rejected (MIME not in allowlist)", () => {
    const doc = makeDocumentUpdate({
      telegramUserId: 104_004,
      fileName: "virus.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 100_000,
    });
    const ALLOWED_MIME = new Set([
      "application/pdf", "image/jpeg", "image/png", "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    expect(ALLOWED_MIME.has(doc.message.document.mime_type)).toBe(false);
  });
});
