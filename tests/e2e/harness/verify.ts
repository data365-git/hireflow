// tests/e2e/harness/verify.ts
import { db, pool } from "@/lib/db/client";
import { applications, candidates, auditLogs, timelineEvents } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

export async function countApplications(vacancyId: string): Promise<number> {
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.vacancyId, vacancyId));
  return rows.length;
}

export async function getApplication(candidateTelegramId: number, vacancyId: string) {
  const cand = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(eq(candidates.telegramUserId, String(candidateTelegramId)));
  if (!cand[0]) return null;

  const apps = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.candidateId, cand[0].id),
        eq(applications.vacancyId, vacancyId)
      )
    );
  return apps[0] ?? null;
}

export async function getSourceDistribution(vacancyId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      sourceId: applications.sourceId,
      count: sql<string>`count(*)`,
    })
    .from(applications)
    .where(eq(applications.vacancyId, vacancyId))
    .groupBy(applications.sourceId);

  return Object.fromEntries(
    rows.map((r) => [r.sourceId ?? "_null", Number(r.count)])
  );
}

export async function assertNoDuplicateApplications(vacancyId: string): Promise<void> {
  const result = await pool.query<{ candidate_id: string; n: string }>(
    `SELECT candidate_id, COUNT(*) AS n
     FROM applications
     WHERE vacancy_id = $1
     GROUP BY candidate_id
     HAVING COUNT(*) > 1`,
    [vacancyId]
  );
  if (result.rows.length > 0) {
    throw new Error(
      `Duplicate applications found: ${JSON.stringify(result.rows)}`
    );
  }
}

export async function getAuditEvents(vacancyId: string, action?: string) {
  const conditions = [eq(auditLogs.vacancyId, vacancyId)];
  if (action) conditions.push(eq(auditLogs.action, action));
  return db.select().from(auditLogs).where(and(...conditions));
}

/** Returns timeline_events rows for a given applicationId (stage changes, etc.) */
export async function getTimelineEvents(applicationId: string) {
  return db.select().from(timelineEvents).where(eq(timelineEvents.applicationId, applicationId));
}

export async function getApplicationStatus(candidateTelegramId: number, vacancyId: string) {
  const app = await getApplication(candidateTelegramId, vacancyId);
  return app?.status ?? null;
}

export async function isApplicationSubmitted(candidateTelegramId: number, vacancyId: string): Promise<boolean> {
  const app = await getApplication(candidateTelegramId, vacancyId);
  return app?.status === "submitted";
}

/** Returns current pool total connections — useful for high-water mark tracking. */
export function getPoolTotalCount(): number {
  return (pool as unknown as { totalCount: number }).totalCount ?? 0;
}

export function getHeapUsageMB(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

export type RunReport = {
  scenario: string;
  totalMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  counts: Record<string, number>;
  errors: string[];
  dbPoolHighWater: number;
  heapDeltaMB: number;
};

export function buildReport(
  scenario: string,
  latencies: number[],
  counts: Record<string, number>,
  errors: string[],
  totalMs: number,
  dbPoolHighWater: number,
  heapBefore: number
): RunReport {
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.floor(sorted.length * q)] ?? 0;
  return {
    scenario,
    totalMs,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
    p99Ms: p(0.99),
    counts,
    errors,
    dbPoolHighWater,
    heapDeltaMB: Math.round((getHeapUsageMB() - heapBefore) * 10) / 10,
  };
}

export function writeReport(report: RunReport): void {
  const dir = resolve(process.cwd(), "tests/reports");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${report.scenario}-${Date.now()}.json`), JSON.stringify(report, null, 2));
  writeFileSync(resolve(dir, "latest.json"), JSON.stringify(report, null, 2));
}
