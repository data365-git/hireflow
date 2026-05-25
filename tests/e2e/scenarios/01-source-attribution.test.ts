// tests/e2e/scenarios/01-source-attribution.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { getApplication, getSourceDistribution } from "../harness/verify";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";

describe("01 — Source Attribution", () => {
  test("first-touch attribution: 2nd source link click does not overwrite initial sourceId", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [srcA, srcB] = await seedSources(vacancyId, ["Instagram", "Telegram"]);
    const cand = makeCandidate({ telegramUserId: 101_001 });

    await sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcA.id}` }));
    await sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${vacancyId}_${srcB.id}` }));

    const app = await getApplication(cand.telegramUserId, vacancyId);
    expect(app?.sourceId).toBe(srcA.id); // first-touch wins
  });

  test("no source payload → sourceId is null (Direct/Untagged traffic)", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const cand = makeCandidate({ telegramUserId: 101_002 });

    await sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: vacancyId }));

    const app = await getApplication(cand.telegramUserId, vacancyId);
    expect(app?.sourceId).toBeNull();
  });

  test("sourceId from a different vacancy is nulled", async () => {
    const hr = await seedHrUser();
    const v1 = await seedVacancy({ hrId: hr.id, title: "V1" });
    const v2 = await seedVacancy({ hrId: hr.id, title: "V2" });
    const [srcV2] = await seedSources(v2, ["Source for V2"]);
    const cand = makeCandidate({ telegramUserId: 101_003 });

    await sendUpdate(makeStartUpdate({ telegramUserId: cand.telegramUserId, payload: `${v1}_${srcV2.id}` }));

    const app = await getApplication(cand.telegramUserId, v1);
    expect(app?.sourceId).toBeNull();
  });

  test("attribution distributes correctly across 4 sources (20 candidates)", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [s1, s2, s3, s4] = await seedSources(vacancyId, ["IG", "TG", "Ref", "Email"]);
    const srcIds = [s1.id, s2.id, s3.id, s4.id];

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        sendUpdate(makeStartUpdate({
          telegramUserId: 101_100 + i,
          payload: `${vacancyId}_${srcIds[i % 4]}`,
        }))
      )
    );

    const dist = await getSourceDistribution(vacancyId);
    for (const src of [s1, s2, s3, s4]) {
      expect(dist[src.id]).toBe(5);
    }
  });

  test("full application submission retains source attribution end-to-end", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Newsletter"]);
    const cand = makeCandidate({ telegramUserId: 101_200 });

    await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand, questionCount: 0 });

    const app = await getApplication(cand.telegramUserId, vacancyId);
    expect(app?.status).toBe("submitted");
    expect(app?.sourceId).toBe(src.id);
  });
});
