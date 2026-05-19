"use server";
import { db } from "@/lib/db/client";
import { telegramMessages, applications, candidates, vacancies, sources } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type InboxConversation = {
  candidateId: string;
  candidateName: string;
  applicationId: string;
  applicationStatus: string;
  currentStageId: string;
  vacancyId: string;
  vacancyTitle: string;
  lastMessageText: string | null;
  lastMessageDirection: "inbound" | "outbound" | null;
  lastMessageAt: string | null;
  unreadCount: number;
  sourceName: string | null;
};

export type InboxMessage = {
  id: string;
  candidateId: string;
  applicationId: string | null;
  direction: string;
  senderType: string;
  senderName: string | null;
  text: string;
  sentAt: string;
  readByUserIds: string[];
  attachmentFileId: string | null;
  attachmentType: string | null;
  attachmentFilename: string | null;
};

function toInboxMessage(row: typeof telegramMessages.$inferSelect): InboxMessage {
  return {
    id: row.id,
    candidateId: row.candidateId,
    applicationId: row.applicationId,
    direction: row.direction,
    senderType: row.senderType,
    senderName: row.senderName,
    text: row.text,
    sentAt: row.sentAt.toISOString(),
    readByUserIds: row.readByUserIds ?? [],
    attachmentFileId: row.attachmentFileId,
    attachmentType: row.attachmentType,
    attachmentFilename: row.attachmentFilename,
  };
}

export async function getInboxConversations(): Promise<InboxConversation[]> {
  // Inbox is exclusively for real Telegram bot conversations — always isDemo=false,
  // regardless of the admin's current UI mode (demo vs live).
  const msgs = await db
    .select({
      msgId: telegramMessages.id,
      candidateId: telegramMessages.candidateId,
      candidateName: candidates.fullName,
      applicationId: telegramMessages.applicationId,
      applicationStatus: applications.status,
      currentStageId: applications.currentStageId,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      text: telegramMessages.text,
      direction: telegramMessages.direction,
      sentAt: telegramMessages.sentAt,
      readByUserIds: telegramMessages.readByUserIds,
      sourceName: sources.name,
    })
    .from(telegramMessages)
    .innerJoin(candidates, eq(telegramMessages.candidateId, candidates.id))
    .leftJoin(applications, eq(telegramMessages.applicationId, applications.id))
    .leftJoin(vacancies, eq(applications.vacancyId, vacancies.id))
    .leftJoin(sources, eq(applications.sourceId, sources.id))
    .where(eq(candidates.isDemo, false))
    .orderBy(asc(telegramMessages.sentAt));

  // Group by applicationId (or candidateId if no applicationId)
  const groupKey = (m: typeof msgs[0]) => m.applicationId ?? m.candidateId;

  const grouped = new Map<string, typeof msgs>();
  for (const m of msgs) {
    const k = groupKey(m);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(m);
  }

  const result: InboxConversation[] = [];
  for (const [, group] of grouped) {
    const last = group[group.length - 1];
    const unreadCount = group.filter(
      (m) => m.direction === "inbound" && (!m.readByUserIds || (m.readByUserIds as string[]).length === 0)
    ).length;
    result.push({
      candidateId: last.candidateId,
      candidateName: last.candidateName,
      applicationId: last.applicationId ?? "",
      applicationStatus: last.applicationStatus ?? "",
      currentStageId: last.currentStageId ?? "",
      vacancyId: last.vacancyId ?? "",
      vacancyTitle: last.vacancyTitle ?? "",
      lastMessageText: last.text,
      lastMessageDirection: last.direction as "inbound" | "outbound",
      lastMessageAt: last.sentAt?.toISOString() ?? null,
      unreadCount,
      sourceName: last.sourceName ?? null,
    });
  }

  result.sort((a, b) => {
    const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bT - aT;
  });

  return result;
}

export async function sendMessageToCandidate(applicationId: string, text: string): Promise<InboxMessage> {
  const messageText = text.trim();
  if (!messageText) {
    throw new Error("Message cannot be empty");
  }

  // Always operate on live candidates — Telegram messages are never demo data.
  const rows = await db
    .select({ app: applications, cand: candidates })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, false)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, false)))
    .where(eq(applications.id, applicationId));

  const row = rows[0];
  if (!row?.cand.telegramUserId) {
    throw new Error("Candidate has no Telegram ID — cannot send message");
  }

  // 2. Send via Telegram Bot API
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: row.cand.telegramUserId,
      text: messageText,
      parse_mode: "Markdown",
    }),
  });

  const result = await res.json();
  if (!result.ok) {
    console.error("Telegram send failed:", result);
    throw new Error(`Telegram error: ${result.description}`);
  }

  // 3. Save to DB
  const [inserted] = await db.insert(telegramMessages).values({
    id: crypto.randomUUID(),
    candidateId: row.cand.id,
    applicationId,
    direction: "outbound",
    senderType: "hr",
    text: messageText,
    sentAt: new Date(),
    readByUserIds: [],
  }).returning();

  revalidatePath("/inbox");
  revalidatePath(`/candidates/${applicationId}`);
  return toInboxMessage(inserted);
}

export async function getMessagesForApplication(applicationId: string): Promise<InboxMessage[]> {
  const rows = await db
    .select()
    .from(telegramMessages)
    .where(eq(telegramMessages.applicationId, applicationId))
    .orderBy(telegramMessages.sentAt);
  return rows.map(toInboxMessage);
}

// Used when a conversation has no applicationId (pre-application bot messages)
export async function getMessagesByCandidateId(candidateId: string): Promise<InboxMessage[]> {
  const rows = await db
    .select()
    .from(telegramMessages)
    .where(eq(telegramMessages.candidateId, candidateId))
    .orderBy(telegramMessages.sentAt);
  return rows.map(toInboxMessage);
}

export async function getInboxUnreadCount(): Promise<number> {
  // Always count from live candidates — inbox is bot-only, always isDemo=false.
  const msgs = await db
    .select({ readByUserIds: telegramMessages.readByUserIds, direction: telegramMessages.direction })
    .from(telegramMessages)
    .innerJoin(candidates, eq(telegramMessages.candidateId, candidates.id))
    .where(eq(candidates.isDemo, false));

  return msgs.filter(
    (m) => m.direction === "inbound" && (!m.readByUserIds || (m.readByUserIds as string[]).length === 0)
  ).length;
}

export async function markMessagesRead(applicationId: string) {
  await db
    .update(telegramMessages)
    .set({ readByUserIds: [] }) // simple reset — no multi-user tracking needed here
    .where(eq(telegramMessages.applicationId, applicationId));
  revalidatePath(`/candidates/${applicationId}`);
}
