import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { getApplication } from "../harness/verify";
import { getSourceStatsForVacancy } from "@/app/actions/sources";
import { moveApplicationToStage } from "@/app/actions/applications";
import { db } from "@/lib/db/client";
import { vacancyStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("06 — Source Stats", () => {
  test("getSourceStatsForVacancy counts hired via stage join, not phantom status", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Instagram"]);

    // Create 5 applications, move 2 to hired stage
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({ telegramUserId: 106_000 + i })
    );
    for (const cand of candidates) {
      await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand });
    }

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const hiredStage = stages.find((s) => s.isFinal && !s.isRejected)!;

    // Move first 2 to hired
    for (let i = 0; i < 2; i++) {
      const app = await getApplication(candidates[i].telegramUserId, vacancyId);
      await moveApplicationToStage(app!.id, hiredStage.id);
    }

    const stats = await getSourceStatsForVacancy(vacancyId);
    const stat = stats.find((s) => s.sourceId === src.id)!;

    expect(stat.views).toBe(5);
    expect(stat.submitted).toBe(5);   // all submitted
    expect(stat.hired).toBe(2);       // NOT 0 — this was the bug
  });

  test("archived source is excluded from stats", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Archived Source"]);

    await import("@/app/actions/sources").then(m => m.archiveSource(src.id));

    const stats = await getSourceStatsForVacancy(vacancyId);
    expect(stats.find((s) => s.sourceId === src.id)).toBeUndefined();
  });
});
