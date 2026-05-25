import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate, STANDARD_STAGES } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { countApplications, getSourceDistribution, isApplicationSubmitted, getAuditEvents } from "../harness/verify";

describe("00 — Smoke", () => {
  test("one HR creates a vacancy, one candidate applies and submits", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id, title: "QA Engineer" });
    const [srcA] = await seedSources(vacancyId, ["Instagram"]);
    const cand = makeCandidate({ telegramUserId: 100_001 });

    await driveFullApplication({ vacancyId, sourceId: srcA.id, candidate: cand });

    expect(await countApplications(vacancyId)).toBe(1);
    expect(await isApplicationSubmitted(cand.telegramUserId, vacancyId)).toBe(true);

    const dist = await getSourceDistribution(vacancyId);
    expect(dist[srcA.id]).toBe(1);
  });

  test("candidate who browses does NOT appear as submitted", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const cand = makeCandidate({ telegramUserId: 100_002 });

    await driveFullApplication({ vacancyId, candidate: cand, browseOnly: true });

    expect(await isApplicationSubmitted(cand.telegramUserId, vacancyId)).toBe(false);
    expect(await countApplications(vacancyId)).toBe(1); // browsing = still an app row
  });
});
