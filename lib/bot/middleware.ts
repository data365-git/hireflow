import type { Context, NextFunction } from "grammy";
import { getBotSession, getLatestApplicationIdForTelegramUser, upsertCandidateFromTelegram, saveBotMessage } from "@/app/actions/bot";

// Stash candidateId on the context for downstream handlers
declare module "grammy" {
  interface Context {
    state: { candidateId?: string };
  }
}

export async function persistenceMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();

  // 1) Upsert candidate
  const candidateId = await upsertCandidateFromTelegram({
    telegramUserId: String(ctx.from.id),
    telegramUsername: ctx.from.username,
    telegramFirstName: ctx.from.first_name,
  });

  // Stash for handlers
  (ctx as any).state = (ctx as any).state ?? {};
  (ctx as any).state.candidateId = candidateId;

  async function currentApplicationId() {
    const session = await getBotSession(String(ctx.from!.id)).catch(() => null);
    return session?.applicationId ?? await getLatestApplicationIdForTelegramUser(String(ctx.from!.id)).catch(() => null);
  }

  // 2) Save inbound message
  try {
    const applicationId = await currentApplicationId();
    if (ctx.message?.text) {
      await saveBotMessage({
        candidateId,
        applicationId,
        direction: "inbound",
        text: ctx.message.text,
      });
    } else if (ctx.message?.photo) {
      const photo = ctx.message.photo.at(-1);
      await saveBotMessage({
        candidateId,
        applicationId,
        direction: "inbound",
        text: ctx.message.caption ?? "",
        attachmentFileId: photo?.file_id,
        attachmentType: "photo",
      });
    } else if (ctx.message?.document) {
      await saveBotMessage({
        candidateId,
        applicationId,
        direction: "inbound",
        text: ctx.message.caption ?? "",
        attachmentFileId: ctx.message.document.file_id,
        attachmentType: "document",
        attachmentFilename: ctx.message.document.file_name,
      });
    } else if (ctx.callbackQuery?.data) {
      // Persist the button tap as a "user action" message
      await saveBotMessage({
        candidateId,
        applicationId,
        direction: "inbound",
        text: `[tapped: ${ctx.callbackQuery.data}]`,
      });
    }
  } catch (err) {
    console.error("[persistenceMiddleware] save inbound failed:", err);
  }

  // 3) Wrap ctx.reply to persist outbound messages
  const originalReply = ctx.reply.bind(ctx);
  (ctx as any).reply = async (text: string, other?: any) => {
    const result = await originalReply(text, other);
    try {
      const applicationId = await currentApplicationId();
      await saveBotMessage({
        candidateId,
        applicationId,
        direction: "outbound",
        text,
      });
    } catch (err) {
      console.error("[persistenceMiddleware] save outbound failed:", err);
    }
    return result;
  };

  return next();
}
