"use server";
import { db } from "@/lib/db/client";
import { backupRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";

export type BackupRun = typeof backupRuns.$inferSelect;

export async function listBackupRuns(): Promise<BackupRun[]> {
  await requirePermission("settings", "read");
  return db.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(30);
}
