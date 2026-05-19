"use server";
import { db } from "@/lib/db/client";
import { telegramMessages, applications, candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function sendMessageToCandidate(applicationId: string, text: string) {
  if (!text.trim()) return;

  // 1. Get application → candidate → telegramUserId
  const rows = await db
    .select({ app: applications, cand: candidates })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
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
      text,
      parse_mode: "Markdown",
    }),
  });

  const result = await res.json();
  if (!result.ok) {
    console.error("Telegram send failed:", result);
    throw new Error(`Telegram error: ${result.description}`);
  }

  // 3. Save to DB
  await db.insert(telegramMessages).values({
    id: crypto.randomUUID(),
    applicationId,
    direction: "outbound",
    senderType: "hr",
    text,
    sentAt: new Date(),
    readByUserIds: [],
  });

  revalidatePath(`/candidates/${applicationId}`);
  return result;
}

export async function getMessagesForApplication(applicationId: string) {
  return db
    .select()
    .from(telegramMessages)
    .where(eq(telegramMessages.applicationId, applicationId))
    .orderBy(telegramMessages.sentAt);
}

export async function markMessagesRead(applicationId: string) {
  await db
    .update(telegramMessages)
    .set({ readByUserIds: [] }) // simple reset — no multi-user tracking needed here
    .where(eq(telegramMessages.applicationId, applicationId));
  revalidatePath(`/candidates/${applicationId}`);
}
