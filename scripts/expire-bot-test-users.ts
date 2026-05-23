/**
 * Cron script — disable expired bot test users.
 * Run daily: npx tsx scripts/expire-bot-test-users.ts
 */
import { db } from "@/lib/db/client";
import { botTestUsers } from "@/lib/db/schema";
import { and, eq, isNotNull, lt } from "drizzle-orm";

const now = new Date();

const result = await db
  .update(botTestUsers)
  .set({ isActive: false, updatedAt: now })
  .where(
    and(
      eq(botTestUsers.isActive, true),
      isNotNull(botTestUsers.expiresAt),
      lt(botTestUsers.expiresAt, now),
    ),
  );

const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
console.log(
  `[expire-test-users] Disabled ${count} expired test user(s) at ${now.toISOString()}`,
);
process.exit(0);
