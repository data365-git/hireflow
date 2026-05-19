"use server";
import { db } from "@/lib/db/client";
import { candidates, applications, vacancies, telegramMessages } from "@/lib/db/schema";
import { eq, desc, isNotNull } from "drizzle-orm";

export async function listLeads() {
  const allCandidates = await db
    .select()
    .from(candidates)
    .where(isNotNull(candidates.telegramUserId));

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
