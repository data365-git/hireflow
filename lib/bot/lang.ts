import type { Context } from "grammy";
import { db } from "@/lib/db/client";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { detectLang, type Lang } from "./i18n";

/**
 * Single source of truth for bot reply language.
 * Priority: candidate.languagePref → candidate.language → Telegram language_code → "uz"
 */
export async function resolveBotLang(ctx: Context): Promise<Lang> {
  const tgUserId = ctx.from?.id ? String(ctx.from.id) : null;
  if (tgUserId) {
    const [cand] = await db
      .select({ languagePref: candidates.languagePref, language: candidates.language })
      .from(candidates)
      .where(eq(candidates.telegramUserId, tgUserId));
    const pref = cand?.languagePref ?? cand?.language;
    if (pref === "uz" || pref === "ru" || pref === "en") return pref;
  }
  return detectLang(ctx) ?? "uz";
}
