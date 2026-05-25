import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate, STANDARD_STAGES } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { getApplication, getAuditEvents } from "../harness/verify";
import { moveApplicationToStage } from "@/app/actions/applications";
import { db } from "@/lib/db/client";
import { vacancyStages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

describe("05 — Stage Transitions", () => {
  test("moving application to a stage writes audit log", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Direct"]);
    const cand = makeCandidate({ telegramUserId: 105_001 });

    await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand });

    const app = await getApplication(cand.telegramUserId, vacancyId);
    expect(app).not.toBeNull();

    // Get the "Screening" stage id
    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const screeningStage = stages.find((s) => s.name === "Screening");
    expect(screeningStage).toBeDefined();

    await moveApplicationToStage(app!.id, screeningStage!.id);

    const audits = await getAuditEvents(vacancyId);
    expect(audits.length).toBeGreaterThan(0);
  });

  test("moving to hired stage (isFinal + !isRejected) is reflected in source stats", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["LinkedIn"]);
    const cand = makeCandidate({ telegramUserId: 105_002 });

    await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand });
    const app = await getApplication(cand.telegramUserId, vacancyId);

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const hiredStage = stages.find((s) => s.isFinal && !s.isRejected);
    expect(hiredStage).toBeDefined();

    await moveApplicationToStage(app!.id, hiredStage!.id);

    const { getSourceStatsForVacancy } = await import("@/app/actions/sources");
    const stats = await getSourceStatsForVacancy(vacancyId);
    const srcStat = stats.find((s) => s.sourceId === src.id);
    expect(srcStat?.hired).toBe(1);
  });
});
