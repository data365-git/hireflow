import { db, pool } from "@/lib/db/client";
import { applications, candidates, auditLogs } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

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
  const result = await pool.query<{ candidate_id: string; n: string }>(`
    SELECT candidate_id, COUNT(*) AS n
    FROM applications
    WHERE vacancy_id = $1
    GROUP BY candidate_id
    HAVING COUNT(*) > 1
  `, [vacancyId]);

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

export async function getApplicationStatus(candidateTelegramId: number, vacancyId: string) {
  const app = await getApplication(candidateTelegramId, vacancyId);
  return app?.status ?? null;
}

export async function isApplicationSubmitted(candidateTelegramId: number, vacancyId: string): Promise<boolean> {
  const app = await getApplication(candidateTelegramId, vacancyId);
  return app?.status === "submitted";
}
