import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import { countApplications, assertNoDuplicateApplications, getSourceDistribution } from "../harness/verify";

describe("Load — 100 applicants", () => {
  test(
    "100 candidates apply to one vacancy via 4 sources — no duplicates, correct attribution",
    async () => {
      const hr = await seedHrUser();
      const vacancyId = await seedVacancy({ hrId: hr.id, title: "Mass Hire QA" });
      const [s1, s2, s3, s4] = await seedSources(vacancyId, ["Instagram", "Telegram", "Referral", "Email"]);
      const sourceIds = [s1.id, s2.id, s3.id, undefined]; // 25 each

      const candidates = Array.from({ length: 100 }, (_, i) =>
        makeCandidate({ telegramUserId: 200_000 + i, firstName: `LoadTest${i}` })
      );

      const latencies: number[] = [];
      const startedAt = Date.now();

      // 10 waves of 10 concurrent applications
      for (let wave = 0; wave < 10; wave++) {
        const slice = candidates.slice(wave * 10, (wave + 1) * 10);
        await Promise.all(
          slice.map(async (cand, idx) => {
            const sourceId = sourceIds[(wave * 10 + idx) % 4];
            const t0 = Date.now();
            await driveFullApplication({ vacancyId, sourceId, candidate: cand });
            latencies.push(Date.now() - t0);
          })
        );
      }

      const totalMs = Date.now() - startedAt;

      // Correctness assertions
      expect(await countApplications(vacancyId)).toBe(100);
      await assertNoDuplicateApplications(vacancyId);

      // Attribution assertions
      const dist = await getSourceDistribution(vacancyId);
      expect(dist[s1.id]).toBe(25);
      expect(dist[s2.id]).toBe(25);
      expect(dist[s3.id]).toBe(25);
      expect(dist["_null"]).toBe(25);

      // Performance assertions
      const sorted = [...latencies].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log([
        `100-applicant load test:`,
        `  total=${totalMs}ms`,
        `  p50=${sorted[50]}ms`,
        `  p95=${p95}ms`,
        `  p99=${p99}ms`,
      ].join("\n"));

      expect(p95).toBeLessThan(5_000); // 5s budget per flow at p95 (includes full anketa)
      expect(totalMs).toBeLessThan(120_000);
    },
    { timeout: 180_000 }
  );
});
