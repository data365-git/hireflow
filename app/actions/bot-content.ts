"use server";
import { db } from "@/lib/db/client";
import { botContent } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";

const LANGUAGES = ["uz", "ru", "en"] as const;
const CONTENT_KEYS = ["about_us", "contact_us"] as const;
type Language = (typeof LANGUAGES)[number];
type ContentKey = (typeof CONTENT_KEYS)[number];

export type BotContentRow = {
  id: string;
  key: ContentKey;
  language: Language;
  content: string;
  updatedAt: string;
};

export async function getBotContentAll(): Promise<BotContentRow[]> {
  await requirePermission("settings", "read");
  const rows = await db.select().from(botContent);
  return rows.map((r) => ({
    id: r.id,
    key: r.key as ContentKey,
    language: r.language as Language,
    content: r.content,
    updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function upsertBotContent(
  key: ContentKey,
  language: Language,
  content: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission("settings", "edit");
  if (!content.trim()) return { ok: false, error: "Content cannot be empty" };

  const existing = await db
    .select({ id: botContent.id })
    .from(botContent)
    .where(and(eq(botContent.key, key), eq(botContent.language, language)));

  if (existing[0]) {
    await db
      .update(botContent)
      .set({ content: content.trim(), updatedAt: new Date() })
      .where(and(eq(botContent.key, key), eq(botContent.language, language)));
  } else {
    await db.insert(botContent).values({
      id: crypto.randomUUID(),
      key,
      language,
      content: content.trim(),
      updatedAt: new Date(),
    });
  }

  revalidatePath("/settings/bot-content");
  return { ok: true };
}
