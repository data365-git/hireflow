import type { Context, NextFunction } from "grammy";
import { getBotSession, getLatestApplicationIdForTelegramUser, upsertCandidateFromTelegram, saveBotMessage } from "@/app/actions/bot";
import { tr } from "@/lib/bot/i18n";
import { resolveBotLang } from "@/lib/bot/lang";

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
      const doc = ctx.message.document;
      const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB
      const ALLOWED_MIME = new Set([
        "application/pdf",
        "image/jpeg", "image/png", "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      const isImage = doc.mime_type?.startsWith("image/");
      const sizeLimit = isImage ? 2 * 1024 * 1024 : MAX_DOC_BYTES;

      if (typeof doc.file_size === "number" && doc.file_size > sizeLimit) {
        const key = isImage ? "err_photo_too_large" : "err_doc_too_large";
        const lang = await resolveBotLang(ctx).catch(() => "uz" as const);
        await ctx.reply(tr(lang, key));
        return next();
      }

      if (doc.mime_type && !ALLOWED_MIME.has(doc.mime_type)) {
        const lang = await resolveBotLang(ctx).catch(() => "uz" as const);
        await ctx.reply(tr(lang, "err_doc_type_not_allowed"));
        return next();
      }

      await saveBotMessage({
        candidateId,
        applicationId,
        direction: "inbound",
        text: ctx.message.caption ?? "",
        attachmentFileId: doc.file_id,
        attachmentType: "document",
        attachmentFilename: doc.file_name,
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
