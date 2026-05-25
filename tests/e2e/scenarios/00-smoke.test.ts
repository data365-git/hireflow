// tests/e2e/scenarios/00-smoke.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { countApplications, getSourceDistribution, isApplicationSubmitted } from "../harness/verify";

describe("00 — Smoke", () => {
  test("one HR creates a vacancy, one candidate applies and submits", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id, title: "QA Engineer" });
    const [srcA] = await seedSources(vacancyId, ["Instagram"]);
    const cand = makeCandidate({ telegramUserId: 100_001 });

    await driveFullApplication({ vacancyId, sourceId: srcA.id, candidate: cand, questionCount: 0 });

    expect(await countApplications(vacancyId)).toBe(1);
    expect(await isApplicationSubmitted(cand.telegramUserId, vacancyId)).toBe(true);
    const dist = await getSourceDistribution(vacancyId);
    expect(dist[srcA.id]).toBe(1);
  });

  test("candidate who browses (browseOnly) is NOT submitted", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const cand = makeCandidate({ telegramUserId: 100_002 });

    await driveFullApplication({ vacancyId, candidate: cand, browseOnly: true });

    expect(await isApplicationSubmitted(cand.telegramUserId, vacancyId)).toBe(false);
    expect(await countApplications(vacancyId)).toBe(1); // browsing = still a row
  });

  test("health check endpoint returns 200 with db:connected", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; db: string };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("connected");
  });
});
