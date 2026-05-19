import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

const STRIP = ["passwordHash", "password_hash", "id", "createdAt", "updatedAt"];

export function audit(entry: {
  action: string;
  actorId?: string;
  actorEmail?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}): void {
  const clean = (o: unknown) => {
    if (!o || typeof o !== "object") return o;
    return Object.fromEntries(Object.entries(o as object).filter(([k]) => !STRIP.includes(k)));
  };
  db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    action: entry.action,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityName: entry.entityName,
    description: entry.description,
    before: clean(entry.before) as never,
    after: clean(entry.after) as never,
    ip: entry.ip,
    userAgent: entry.userAgent,
  }).catch((e) => console.error("audit failed", e));
}
