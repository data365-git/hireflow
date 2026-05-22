import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import { vacancies, vacancyDeletionBackups } from "../lib/db/schema";

async function main() {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const backupThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: vacancies.id, title: vacancies.title })
    .from(vacancies)
    .where(and(sql`${vacancies.deletedAt} is not null`, lt(vacancies.deletedAt, threshold)));

  console.log(`[purge] Found ${rows.length} soft-deleted vacancies older than 30 days`);

  for (const row of rows) {
    await db.transaction(async (tx) => {
      await tx
        .update(vacancyDeletionBackups)
        .set({ hardDeletedAt: new Date() })
        .where(eq(vacancyDeletionBackups.vacancyId, row.id));
      await tx.delete(vacancies).where(eq(vacancies.id, row.id));
    });
    console.log(`[purge] Deleted ${row.title} (${row.id})`);
  }

  const oldBackups = await db
    .delete(vacancyDeletionBackups)
    .where(and(sql`${vacancyDeletionBackups.hardDeletedAt} is not null`, lt(vacancyDeletionBackups.deletedAt, backupThreshold)))
    .returning({ id: vacancyDeletionBackups.id });

  console.log(`[purge] Removed ${oldBackups.length} hard-delete backups older than 90 days`);
}

main().catch((error) => {
  console.error("[purge] Failed", error);
  process.exit(1);
});
