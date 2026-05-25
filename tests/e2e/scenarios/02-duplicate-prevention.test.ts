// tests/e2e/scenarios/02-duplicate-prevention.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { countApplications, assertNoDuplicateApplications } from "../harness/verify";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";

describe("02 — Duplicate Prevention", () => {
  test("two concurrent /start for same candidate+vacancy → exactly 1 application row", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const cand = makeCandidate({ telegramUserId: 102_001 });

    const [r1, r2] = await Promise.all([
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: vacancyId })),
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: vacancyId })),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await countApplications(vacancyId)).toBe(1);
    await assertNoDuplicateApplications(vacancyId);
  });

  test("same update_id sent twice → processed exactly once", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });

    const update = makeStartUpdate({ telegramUserId: 102_002, payload: vacancyId });
    const r1 = await sendUpdate(update);
    const r2 = await sendUpdate(update); // identical update_id

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await countApplications(vacancyId)).toBe(1);
  });

  test("10 concurrent /start from distinct candidates → 10 applications, no duplicates", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        sendUpdate(makeStartUpdate({ telegramUserId: 102_100 + i, payload: vacancyId }))
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

    await Promise.all([
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcA.id}` })),
      sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcB.id}` })),
    ]);

    expect(await countApplications(vacancyId)).toBe(1);
    await assertNoDuplicateApplications(vacancyId);
  });
});
