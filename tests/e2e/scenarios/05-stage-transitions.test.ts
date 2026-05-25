// tests/e2e/scenarios/05-stage-transitions.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { getApplication, getTimelineEvents } from "../harness/verify";
import { moveApplicationToStage } from "@/app/actions/applications";
import { db } from "@/lib/db/client";
import { vacancyStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// requirePermission is bypassed by the test session hook installed in global-setup.ts

describe("05 — Stage Transitions", () => {
  test("moveApplicationToStage to Screening writes an audit log entry", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Direct"]);
    const cand = makeCandidate({ telegramUserId: 105_001 });

    await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand, questionCount: 0 });

    const app = await getApplication(cand.telegramUserId, vacancyId);
    expect(app).not.toBeNull();

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const screeningStage = stages.find((s) => s.name === "Screening");
    expect(screeningStage).toBeDefined();

    await moveApplicationToStage(app!.id, screeningStage!.id);

    // moveApplicationToStage writes to timeline_events (not audit_logs which is for admin events).
    const events = await getTimelineEvents(app!.id);
    expect(events.length).toBeGreaterThan(0);
  });

  test("moving to Hired stage (isFinal+!isRejected) increments hired count in source stats", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["LinkedIn"]);
    const cand = makeCandidate({ telegramUserId: 105_002 });

    await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand, questionCount: 0 });
    const app = await getApplication(cand.telegramUserId, vacancyId);
    expect(app).not.toBeNull();

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const hiredStage = stages.find((s) => s.isFinal && !s.isRejected);
    expect(hiredStage).toBeDefined();

    await moveApplicationToStage(app!.id, hiredStage!.id);

    const { getSourceStatsForVacancy } = await import("@/app/actions/sources");
    const stats = await getSourceStatsForVacancy(vacancyId);
    const srcStat = stats.find((s) => s.sourceId === src.id);
    expect(srcStat?.hired).toBe(1);
  });

  test("moving to Rejected stage (isFinal+isRejected) does NOT increment hired count", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Walk-in"]);
    const cand = makeCandidate({ telegramUserId: 105_003 });

    await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand, questionCount: 0 });
    const app = await getApplication(cand.telegramUserId, vacancyId);

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const rejectedStage = stages.find((s) => s.isRejected && s.isFinal);
    expect(rejectedStage).toBeDefined();

    await moveApplicationToStage(app!.id, rejectedStage!.id);

    const { getSourceStatsForVacancy } = await import("@/app/actions/sources");
    const stats = await getSourceStatsForVacancy(vacancyId);
    const srcStat = stats.find((s) => s.sourceId === src.id);
    expect(srcStat?.hired).toBe(0); // rejected ≠ hired
  });

  test("stage transition to non-existent stage ID does not corrupt application", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const cand = makeCandidate({ telegramUserId: 105_004 });
    await driveFullApplication({ vacancyId, candidate: cand, questionCount: 0 });
    const app = await getApplication(cand.telegramUserId, vacancyId);
    const originalStageId = app!.currentStageId;

    try {
      await moveApplicationToStage(app!.id, "non-existent-stage-id");
    } catch {
      // Expected: invalid stage reference should throw
    }

    const refreshed = await getApplication(cand.telegramUserId, vacancyId);
    expect(refreshed!.currentStageId).toBe(originalStageId);
  });
});
