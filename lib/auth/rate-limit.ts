import { db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.attemptedAt, since)));
  return { allowed: count < MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - count) };
}

export async function recordLoginAttempt(ip: string, email: string | null, success: boolean) {
  await db.insert(loginAttempts).values({
    id: crypto.randomUUID(),
    ip,
    email,
    success,
  });
}
