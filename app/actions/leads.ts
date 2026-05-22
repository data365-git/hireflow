"use server";
import { db } from "@/lib/db/client";
import { candidates, applications, vacancies, telegramMessages } from "@/lib/db/schema";
import { eq, desc, isNotNull, and, inArray, isNull } from "drizzle-orm";
import { getCurrentDataMode } from "@/lib/data-mode";

const vacancyNotDeleted = isNull(vacancies.deletedAt);

export async function listLeads() {
  const isDemo = await getCurrentDataMode();
  const allCandidates = await db
    .select()
    .from(candidates)
    .where(and(isNotNull(candidates.telegramUserId), eq(candidates.isDemo, isDemo)));

  if (allCandidates.length === 0) return [];

  const candidateIds = allCandidates.map((c) => c.id);

  // Fetch all messages for these candidates in one query (ordered desc to get latest first)
  const allMessages = await db
    .select()
    .from(telegramMessages)
    .where(inArray(telegramMessages.candidateId, candidateIds))
    .orderBy(desc(telegramMessages.sentAt));

  // Fetch all applications for these candidates — only for demo-mode-matching vacancies
  const allApps = await db
    .select({ app: applications, vacancy: vacancies })
    .from(applications)
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .where(inArray(applications.candidateId, candidateIds))
    .orderBy(desc(applications.appliedAt));

  // Build per-candidate maps (first occurrence = latest due to orderBy desc)
  const latestMsgMap = new Map<string, Date | null>();
  for (const m of allMessages) {
    if (!latestMsgMap.has(m.candidateId)) {
      latestMsgMap.set(m.candidateId, m.sentAt);
    }
  }
  const latestAppMap = new Map<string, typeof allApps[0] | null>();
  for (const a of allApps) {
    if (!latestAppMap.has(a.app.candidateId)) {
      latestAppMap.set(a.app.candidateId, a);
    }
  }

  const results = allCandidates.map((c) => ({
    candidate: c,
    lastMessageAt: latestMsgMap.get(c.id) ?? null,
    latestApplication: latestAppMap.get(c.id) ?? null,
  }));

  results.sort((a, b) => {
    const aT = a.lastMessageAt?.getTime() ?? 0;
    const bT = b.lastMessageAt?.getTime() ?? 0;
    return bT - aT;
  });

  return results;
}

export async function getCandidateConversation(candidateId: string) {
  const isDemo = await getCurrentDataMode();
  // Inner-join candidates solely to verify this candidate belongs to the current data mode.
  // Select only telegramMessages columns to keep the return shape flat.
  return db
    .select({
      id: telegramMessages.id,
      candidateId: telegramMessages.candidateId,
      applicationId: telegramMessages.applicationId,
      direction: telegramMessages.direction,
      senderType: telegramMessages.senderType,
      senderName: telegramMessages.senderName,
      text: telegramMessages.text,
      sentAt: telegramMessages.sentAt,
      readByUserIds: telegramMessages.readByUserIds,
      attachmentFileId: telegramMessages.attachmentFileId,
      attachmentType: telegramMessages.attachmentType,
      attachmentFilename: telegramMessages.attachmentFilename,
    })
    .from(telegramMessages)
    .innerJoin(candidates, and(eq(telegramMessages.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
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
      .select({ app: applications })
      .from(applications)
      .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
      .where(eq(applications.candidateId, c.id));
    const nonAbandoned = apps.filter((a) => a.app.status !== "abandoned");
    if (nonAbandoned.length === 0) count++;
  }
  return count;
}
