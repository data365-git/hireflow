import { db } from "@/lib/db/client";
import { telegramMessages } from "@/lib/db/schema";

type BotMessageInput = {
  candidateId: string;
  applicationId?: string | null;
  direction: "inbound" | "outbound";
  text: string;
  attachmentFileId?: string;
  attachmentType?: "photo" | "document";
  attachmentFilename?: string;
};

export async function saveBotMessageRecord(args: BotMessageInput): Promise<void> {
  await db.insert(telegramMessages).values({
    id: crypto.randomUUID(),
    candidateId: args.candidateId,
    applicationId: args.applicationId ?? null,
    direction: args.direction,
    senderType: args.direction === "inbound" ? "candidate" : "system",
    text: args.text,
    sentAt: new Date(),
    readByUserIds: [],
    attachmentFileId: args.attachmentFileId ?? null,
    attachmentType: args.attachmentType ?? null,
    attachmentFilename: args.attachmentFilename ?? null,
  });
}
