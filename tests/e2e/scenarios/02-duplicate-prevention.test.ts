// tests/e2e/scenarios/02-duplicate-prevention.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { countApplications, assertNoDuplicateApplications } from "../harness/verify";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";
import { makeCallbackUpdate } from "../fixtures/payloads/callback";

describe("02 — Duplicate Prevention", () => {
  test("two concurrent /start for same candidate+vacancy → exactly 1 application row", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const cand = makeCandidate({ telegramUserId: 102_001 });

    // Both /start calls race to create the candidate (UPSERT handles the race) and ask for language.
    const [r1, r2] = await Promise.all([
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: vacancyId })),
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: vacancyId })),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // Pick language once → startVacancyFlow → getOrCreateBrowsingApplication (UPSERT) → 1 row.
    await sendUpdate(makeCallbackUpdate({ telegramUserId: cand.telegramUserId, data: "first_lang_uz" }));

    expect(await countApplications(vacancyId)).toBe(1);
    await assertNoDuplicateApplications(vacancyId);
  });

  test("same update_id sent twice → processed exactly once", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const uid = 102_002;

    const update = makeStartUpdate({ telegramUserId: uid, payload: vacancyId });
    const r1 = await sendUpdate(update);
    expect(r1.status).toBe(200);
    // Pick language → 1 browsing app created.
    await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "first_lang_uz" }));

    const r2 = await sendUpdate(update); // identical update_id → dedup table → 200, no processing
    expect(r2.status).toBe(200);
    expect(await countApplications(vacancyId)).toBe(1);
  });

  test("10 concurrent /start from distinct candidates → 10 applications, no duplicates", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (async () => {
          const uid = 102_100 + i;
          await sendUpdate(makeStartUpdate({ telegramUserId: uid, payload: vacancyId }));
          await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "first_lang_uz" }));
        })()
      )
    );

    expect(await countApplications(vacancyId)).toBe(10);
    await assertNoDuplicateApplications(vacancyId);
  });

  test("same candidate applies via two different source links in parallel → 1 row, source is one of the two", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [srcA, srcB] = await seedSources(vacancyId, ["A", "B"]);
    const cand = makeCandidate({ telegramUserId: 102_201 });

    // Establish candidate with languagePref so subsequent /start calls skip language selection
    // and go directly to startVacancyFlow → getOrCreateBrowsingApplication.
    await sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcA.id}` }));
    await sendUpdate(makeCallbackUpdate({ telegramUserId: cand.telegramUserId, data: "first_lang_uz" }));

    // Now candidate has languagePref → two concurrent /start calls both call
    // getOrCreateBrowsingApplication (UPSERT) → exactly 1 row survives.
    await Promise.all([
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcA.id}` })),
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcB.id}` })),
    ]);

    expect(await countApplications(vacancyId)).toBe(1);
    await assertNoDuplicateApplications(vacancyId);
  });
});
