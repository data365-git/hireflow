// tests/e2e/scenarios/06-source-stats.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { getApplication } from "../harness/verify";
import { getSourceStatsForVacancy, archiveSource } from "@/app/actions/sources";
import { moveApplicationToStage } from "@/app/actions/applications";
import { db } from "@/lib/db/client";
import { vacancyStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// requirePermission is bypassed by the test session hook installed in global-setup.ts

describe("06 — Source Stats", () => {
  test("hired count uses stage join (not phantom status field) — regression guard for T0.4 fix", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Instagram"]);

    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({ telegramUserId: 106_000 + i })
    );
    for (const cand of candidates) {
      await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand, questionCount: 0 });
    }

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const hiredStage = stages.find((s) => s.isFinal && !s.isRejected)!;

    for (let i = 0; i < 2; i++) {
      const app = await getApplication(candidates[i].telegramUserId, vacancyId);
      await moveApplicationToStage(app!.id, hiredStage.id);
    }

    const stats = await getSourceStatsForVacancy(vacancyId);
    const stat = stats.find((s) => s.sourceId === src.id)!;
    expect(stat.submitted).toBe(5);
    expect(stat.hired).toBe(2); // Was always 0 before T0.4 fix — this is the regression guard
  });

  test("archived source is excluded from getSourceStatsForVacancy", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [src] = await seedSources(vacancyId, ["Archived Source"]);

    await archiveSource(src.id);

    const stats = await getSourceStatsForVacancy(vacancyId);
    expect(stats.find((s) => s.sourceId === src.id)).toBeUndefined();
  });

  test("two sources with different hired counts report independently", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });
    const [srcA, srcB] = await seedSources(vacancyId, ["A", "B"]);

    // 2 candidates from A, 1 from B
    const candA1 = makeCandidate({ telegramUserId: 106_200 });
    const candA2 = makeCandidate({ telegramUserId: 106_201 });
    const candB1 = makeCandidate({ telegramUserId: 106_202 });
    for (const [cand, src] of [[candA1, srcA], [candA2, srcA], [candB1, srcB]] as const) {
      await driveFullApplication({ vacancyId, sourceId: src.id, candidate: cand, questionCount: 0 });
    }

    const stages = await db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, vacancyId));
    const hiredStage = stages.find((s) => s.isFinal && !s.isRejected)!;

    // Hire both A candidates
    for (const cand of [candA1, candA2]) {
      const app = await getApplication(cand.telegramUserId, vacancyId);
      await moveApplicationToStage(app!.id, hiredStage.id);
    }

    const stats = await getSourceStatsForVacancy(vacancyId);
    expect(stats.find((s) => s.sourceId === srcA.id)?.hired).toBe(2);
    expect(stats.find((s) => s.sourceId === srcB.id)?.hired).toBe(0);
  });
});
