// tests/e2e/load/100-applicants.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy, seedSources, makeCandidate } from "../fixtures/builders";
import { driveFullApplication } from "../harness/drive-flow";
import {
  countApplications,
  assertNoDuplicateApplications,
  getSourceDistribution,
  getPoolTotalCount,
  getHeapUsageMB,
  buildReport,
  writeReport,
} from "../harness/verify";

describe("Load — 100 applicants", () => {
  test(
    "100 candidates apply to one vacancy via 4 sources — correctness + performance",
    async () => {
      const hr = await seedHrUser();
      const vacancyId = await seedVacancy({ hrId: hr.id, title: "Mass Hire QA" });
      const [s1, s2, s3] = await seedSources(vacancyId, ["Instagram", "Telegram", "Referral"]);
      // 4th bucket = null source (direct traffic)
      const sourceIds: (string | undefined)[] = [s1.id, s2.id, s3.id, undefined];

      const candidates = Array.from({ length: 100 }, (_, i) =>
        makeCandidate({ telegramUserId: 200_000 + i, firstName: `LoadTest${i}` })
      );

      const latencies: number[] = [];
      const errors: string[] = [];
      let dbPoolHighWater = 0;
      const heapBefore = getHeapUsageMB();
      const startedAt = Date.now();

      // 10 waves of 10 concurrent full applications
      for (let wave = 0; wave < 10; wave++) {
        const slice = candidates.slice(wave * 10, (wave + 1) * 10);
        await Promise.all(
          slice.map(async (cand, idx) => {
            const sourceId = sourceIds[(wave * 10 + idx) % 4];
            const t0 = Date.now();
            try {
              await driveFullApplication({ vacancyId, sourceId, candidate: cand, questionCount: 0 });
            } catch (err) {
              errors.push(`uid=${cand.telegramUserId}: ${(err as Error).message}`);
            }
            latencies.push(Date.now() - t0);
            dbPoolHighWater = Math.max(dbPoolHighWater, getPoolTotalCount());
          })
        );
      }

      const totalMs = Date.now() - startedAt;

      // ── Correctness assertions ───────────────────────────────────────────
      expect(errors, `${errors.length} flows failed:\n${errors.slice(0, 5).join("\n")}`).toHaveLength(0);
      expect(await countApplications(vacancyId)).toBe(100);
      await assertNoDuplicateApplications(vacancyId);

      const dist = await getSourceDistribution(vacancyId);
      expect(dist[s1.id]).toBe(25);
      expect(dist[s2.id]).toBe(25);
      expect(dist[s3.id]).toBe(25);
      expect(dist["_null"]).toBe(25);

      // ── Performance assertions ───────────────────────────────────────────
      const sorted = [...latencies].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.50)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log(
        `\n100-applicant load:\n` +
        `  total=${totalMs}ms  p50=${p50}ms  p95=${p95}ms  p99=${p99}ms\n` +
        `  dbPoolHighWater=${dbPoolHighWater}  heapDelta=${Math.round(getHeapUsageMB() - heapBefore)}MB`
      );

      // Rationale: full flow ≈ 20 in-process DB calls × ~50ms each = ~1s ideal.
      // p95=3s allows for wave-end pool contention.
      // p99=6s allows for one slow outlier per 100.
      // total=60s for 10 waves × ~3-5s each.
      expect(p95, `p95 ${p95}ms exceeded 3000ms budget`).toBeLessThan(3_000);
      expect(p99, `p99 ${p99}ms exceeded 6000ms budget`).toBeLessThan(6_000);
      expect(totalMs, `total ${totalMs}ms exceeded 60s budget`).toBeLessThan(60_000);

      // ── Write JSON report ────────────────────────────────────────────────
      const report = buildReport(
        "100-applicants",
        latencies,
        { total: 100, s1: dist[s1.id] ?? 0, s2: dist[s2.id] ?? 0, s3: dist[s3.id] ?? 0, direct: dist["_null"] ?? 0 },
        errors,
        totalMs,
        dbPoolHighWater,
        heapBefore
      );
      writeReport(report);
    },
    { timeout: 180_000 }
  );
});
