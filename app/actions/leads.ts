"use server";
import { db } from "@/lib/db/client";
import { candidates, applications, vacancies, telegramMessages } from "@/lib/db/schema";
import { eq, desc, isNotNull, and } from "drizzle-orm";
import { getCurrentDataMode } from "@/lib/data-mode";

export async function listLeads() {
  const isDemo = await getCurrentDataMode();
  const allCandidates = await db
    .select()
    .from(candidates)
    .where(and(isNotNull(candidates.telegramUserId), eq(candidates.isDemo, isDemo)));

  const results = [];
  for (const c of allCandidates) {
    const latestMsg = await db
      .select()
      .from(telegramMessages)
      .where(eq(telegramMessages.candidateId, c.id))
      .orderBy(desc(telegramMessages.sentAt))
      .limit(1);

    const latestApp = await db
      .select({ app: applications, vacancy: vacancies })
      .from(applications)
      .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
      .where(eq(applications.candidateId, c.id))
      .orderBy(desc(applications.appliedAt))
      .limit(1);

    results.push({
      candidate: c,
      lastMessageAt: latestMsg[0]?.sentAt ?? null,
      latestApplication: latestApp[0] ?? null,
    });
  }

  results.sort((a, b) => {
    const aT = a.lastMessageAt?.getTime() ?? 0;
    const bT = b.lastMessageAt?.getTime() ?? 0;
    return bT - aT;
  });

  return results;
}

export async function getCandidateConversation(candidateId: string) {
  return db
    .select()
    .from(telegramMessages)
    .where(eq(telegramMessages.candidateId, candidateId))
    .orderBy(telegramMessages.sentAt);
}

export async function getBrowsingLeadsCount(): Promise<number> {
  // Candidates with telegramUserId that have no applications (or only abandoned ones)
  const isDemo = await getCurrentDataMode();
  const allCandidates = await db
    .select()
    .from(candidates)
    .where(and(isNotNull(candidates.telegramUserId), eq(candidates.isDemo, isDemo)));

  let count = 0;
  for (const c of allCandidates) {
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.candidateId, c.id));
    const nonAbandoned = apps.filter((a) => a.status !== "abandoned");
    if (nonAbandoned.length === 0) count++;
  }
  return count;
}
