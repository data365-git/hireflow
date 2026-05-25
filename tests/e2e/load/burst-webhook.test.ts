import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources } from "../fixtures/builders";
import { countApplications, assertNoDuplicateApplications } from "../harness/verify";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";

describe("Load — Burst Webhook", () => {
  test(
    "50 concurrent /start from different candidates → 50 distinct applications, all 200s",
    async () => {
      const hr = await seedHrUser();
      const vacancyId = await seedVacancy({ hrId: hr.id });
      const [src] = await seedSources(vacancyId, ["Load Test"]);

      const updates = Array.from({ length: 50 }, (_, i) =>
        makeStartUpdate({ telegramUserId: 300_000 + i, payload: `${vacancyId}_${src.id}` })
      );

      const results = await Promise.all(updates.map(sendUpdate));

      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(await countApplications(vacancyId)).toBe(50);
      await assertNoDuplicateApplications(vacancyId);
    },
    { timeout: 60_000 }
  );

  test(
    "same /start update retried 10 times → idempotent, still 1 application",
    async () => {
      const hr = await seedHrUser();
      const vacancyId = await seedVacancy({ hrId: hr.id });

      const update = makeStartUpdate({ telegramUserId: 300_999, payload: vacancyId });
      await Promise.all(Array.from({ length: 10 }, () => sendUpdate(update)));

      expect(await countApplications(vacancyId)).toBe(1);
    },
    { timeout: 30_000 }
  );
});
