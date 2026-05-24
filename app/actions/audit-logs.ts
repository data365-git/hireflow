"use server";

import { and, desc, gte, lte, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/permissions";

export type AuditLogRow = {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  description: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type AuditLogFilters = {
  actorEmail?: string;
  action?: string;
  entityType?: string;
  from?: string; // ISO date string
  to?: string;   // ISO date string
};

export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogRow[]> {
  await requirePermission("settings", "read");

  const conditions = [];

  if (filters.actorEmail?.trim()) {
    conditions.push(ilike(auditLogs.actorEmail, `%${filters.actorEmail.trim()}%`));
  }
  if (filters.action?.trim()) {
    conditions.push(ilike(auditLogs.action, `%${filters.action.trim()}%`));
  }
  if (filters.entityType?.trim()) {
    conditions.push(eq(auditLogs.entityType, filters.entityType.trim()));
  }
  if (filters.from) {
    conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    // Include the full "to" day
    const toDate = new Date(filters.to);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lte(auditLogs.createdAt, toDate));
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorId: row.actorId ?? null,
    actorEmail: row.actorEmail ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    entityName: row.entityName ?? null,
    description: row.description ?? null,
    before: row.before ?? null,
    after: row.after ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
