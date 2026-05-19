"use server";

import { db } from "@/lib/db/client";
import { sources, applications, vacancies } from "@/lib/db/schema";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { getCurrentDataMode } from "@/lib/data-mode";

export type SourcePerformanceRow = {
  sourceId: string;
  sourceName: string;
  vacancyId: string;
  vacancyTitle: string;
  total: number;
  browsing: number;
  in_progress: number;
  submitted: number;
  abandoned: number;
};

export async function getSourcePerformance(opts?: {
  vacancyId?: string;
  days?: number;
}): Promise<SourcePerformanceRow[]> {
  await requirePermission("analytics", "read");
  const isDemo = await getCurrentDataMode();

  const days = opts?.days ?? 30;
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const conditions = [
    eq(sources.isArchived, false),
    eq(vacancies.isDemo, isDemo),
    isNotNull(applications.sourceId),
  ];

  if (opts?.vacancyId) {
    conditions.push(eq(applications.vacancyId, opts.vacancyId));
  }

  if (since) {
    conditions.push(gte(applications.appliedAt, since));
  }

  const rows = await db
    .select({
      sourceId: sources.id,
      sourceName: sources.name,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      applicationStatus: applications.status,
    })
    .from(sources)
    .innerJoin(applications, eq(applications.sourceId, sources.id))
    .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
    .where(and(...conditions));

  // Aggregate in JS
  const map = new Map<string, SourcePerformanceRow>();

  for (const row of rows) {
    const key = `${row.sourceId}::${row.vacancyId}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        vacancyId: row.vacancyId,
        vacancyTitle: row.vacancyTitle,
        total: 0,
        browsing: 0,
        in_progress: 0,
        submitted: 0,
        abandoned: 0,
      };
      map.set(key, entry);
    }

    entry.total += 1;
    const status = row.applicationStatus as string;
    if (status === "browsing") entry.browsing += 1;
    else if (status === "in_progress") entry.in_progress += 1;
    else if (status === "submitted") entry.submitted += 1;
    else if (status === "abandoned") entry.abandoned += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
