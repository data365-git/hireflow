"use server";

import { validateEnv } from "@/lib/env";
import { db } from "@/lib/db/client";
import { sources, applications, vacancies, vacancyStages } from "@/lib/db/schema";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { getCurrentDataMode } from "@/lib/data-mode";
import type { Source } from "@/lib/types";

validateEnv();

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeSource(row: typeof sources.$inferSelect): Source {
  return {
    id: row.id,
    vacancyId: row.vacancyId,
    name: row.name,
    botLink: row.botLink,
    isArchived: row.isArchived,
    createdAt: toIso(row.createdAt),
  };
}

export async function listSourcesForVacancy(
  vacancyId: string,
  includeArchived = false
): Promise<Source[]> {
  await requirePermission("vacancies", "read");

  const conditions = [eq(sources.vacancyId, vacancyId)];
  if (!includeArchived) conditions.push(eq(sources.isArchived, false));

  const rows = await db
    .select()
    .from(sources)
    .where(and(...conditions))
    .orderBy(sources.createdAt);

  return rows.map(serializeSource);
}

export async function renameSource(input: { id: string; name: string }): Promise<void> {
  await requirePermission("vacancies", "edit");
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Source name is required.");
  await db.update(sources).set({ name: trimmed }).where(eq(sources.id, input.id));
}

export async function archiveSource(id: string): Promise<void> {
  await requirePermission("vacancies", "edit");
  await db.update(sources).set({ isArchived: true }).where(eq(sources.id, id));
}

export async function unarchiveSource(id: string): Promise<void> {
  await requirePermission("vacancies", "edit");
  await db.update(sources).set({ isArchived: false }).where(eq(sources.id, id));
}

export async function setApplicationSource(input: {
  applicationId: string;
  sourceId: string | null;
}): Promise<void> {
  const session = await requirePermission("candidates", "edit");

  const [app] = await db
    .select({ id: applications.id, vacancyId: applications.vacancyId, sourceId: applications.sourceId })
    .from(applications)
    .where(eq(applications.id, input.applicationId));

  if (!app) throw new Error("Application not found.");

  if (input.sourceId !== null) {
    const [src] = await db
      .select({ id: sources.id, vacancyId: sources.vacancyId })
      .from(sources)
      .where(eq(sources.id, input.sourceId));

    if (!src) throw new Error("Source not found.");
    if (src.vacancyId !== app.vacancyId) {
      throw new Error("Source does not belong to this vacancy.");
    }
  }

  await db
    .update(applications)
    .set({ sourceId: input.sourceId })
    .where(eq(applications.id, input.applicationId));

  // Fire-and-forget audit log (table exists in schema)
  void (async () => {
    const { audit } = await import("@/lib/auth/audit");
    const { revalidatePath } = await import("next/cache");
    audit({
      action: "application.source.set",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "application",
      entityId: input.applicationId,
      description: input.sourceId
        ? `Source set to ${input.sourceId}`
        : "Source cleared",
      before: { sourceId: app.sourceId },
      after: { sourceId: input.sourceId },
    });
    revalidatePath(`/candidates/${input.applicationId}`);
  })();
}

export type SourceStatRow = {
  sourceId: string;
  views: number;
  submitted: number;
  hired: number;
};

export async function getSourceStatsForVacancy(
  vacancyId: string
): Promise<SourceStatRow[]> {
  await requirePermission("vacancies", "read");

  // Get all non-archived sources for this vacancy
  const sourceRows = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.vacancyId, vacancyId), eq(sources.isArchived, false)));

  if (sourceRows.length === 0) return [];

  const sourceIds = sourceRows.map((r) => r.id);

  const appRows = await db
    .select({ sourceId: applications.sourceId, status: applications.status })
    .from(applications)
    .where(
      and(
        eq(applications.vacancyId, vacancyId),
        isNotNull(applications.sourceId),
        inArray(applications.sourceId, sourceIds)
      )
    );

  const map = new Map<string, SourceStatRow>();
  for (const src of sourceRows) {
    map.set(src.id, { sourceId: src.id, views: 0, submitted: 0, hired: 0 });
  }

  for (const row of appRows) {
    if (!row.sourceId) continue;
    const entry = map.get(row.sourceId);
    if (!entry) continue;
    entry.views += 1;
    const s = row.status as string;
    if (s === "submitted" || s === "in_pipeline" || s === "hired" || s === "rejected") {
      entry.submitted += 1;
    }
    if (s === "hired") entry.hired += 1;
  }

  return Array.from(map.values());
}

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

export type SourcePerformanceByNameRow = {
  name: string;
  views: number;
  submitted: number;
  hired: number;
  submissionRate: number;
  hireRate: number;
  vacancyCount: number;
};

export async function getSourcePerformanceByName(args?: {
  days?: number;
}): Promise<SourcePerformanceByNameRow[]> {
  await requirePermission("analytics", "read");
  const isDemo = await getCurrentDataMode();

  const days = args?.days ?? 30;
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const conditions = [
    eq(sources.isArchived, false),
    eq(vacancies.isDemo, isDemo),
    isNotNull(applications.sourceId),
  ];

  if (since) {
    conditions.push(gte(applications.appliedAt, since));
  }

  const rows = await db
    .select({
      sourceName: sources.name,
      vacancyId: vacancies.id,
      applicationStatus: applications.status,
      stageIsFinal: vacancyStages.isFinal,
      stageIsRejected: vacancyStages.isRejected,
    })
    .from(sources)
    .innerJoin(applications, eq(applications.sourceId, sources.id))
    .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
    .innerJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .where(and(...conditions));

  // Aggregate by lowercase source name
  const map = new Map<string, SourcePerformanceByNameRow & { _vacancyIds: Set<string> }>();

  for (const row of rows) {
    const key = row.sourceName.toLowerCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        name: row.sourceName,
        views: 0,
        submitted: 0,
        hired: 0,
        submissionRate: 0,
        hireRate: 0,
        vacancyCount: 0,
        _vacancyIds: new Set(),
      };
      map.set(key, entry);
    }

    entry.views += 1;
    entry._vacancyIds.add(row.vacancyId);

    const status = row.applicationStatus as string;
    if (status === "submitted") entry.submitted += 1;
    if (row.stageIsFinal && !row.stageIsRejected) entry.hired += 1;
  }

  return Array.from(map.values())
    .map(({ _vacancyIds, ...entry }) => ({
      ...entry,
      vacancyCount: _vacancyIds.size,
      submissionRate: entry.views > 0 ? entry.submitted / entry.views : 0,
      hireRate: entry.views > 0 ? entry.hired / entry.views : 0,
    }))
    .sort((a, b) => b.views - a.views);
}
