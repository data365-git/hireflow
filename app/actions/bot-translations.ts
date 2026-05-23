"use server";
import { db } from "@/lib/db/client";
import { botTranslations } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { t as codeStrings } from "@/lib/bot/i18n";
import type { Lang } from "@/lib/bot/i18n";

const LANGS: Lang[] = ["uz", "ru", "en"];

export async function listBotTranslations() {
  await requirePermission("settings.translations", "read");
  // Get all keys from code strings (uz as source of truth)
  const allKeys = Object.keys(codeStrings.uz);
  const dbRows = await db.select().from(botTranslations);

  // Build a map: key → { uz, ru, en } from DB, fallback to code
  const map = new Map<string, Record<string, string>>();
  for (const key of allKeys) {
    const entry: Record<string, string> = {};
    for (const lang of LANGS) {
      entry[lang] = codeStrings[lang]?.[key] ?? "";
    }
    map.set(key, entry);
  }
  for (const row of dbRows) {
    if (!map.has(row.key)) map.set(row.key, { uz: "", ru: "", en: "" });
    map.get(row.key)![row.language] = row.value;
  }

  return Array.from(map.entries()).map(([key, langs]) => ({
    key,
    uz: langs.uz ?? "",
    ru: langs.ru ?? "",
    en: langs.en ?? "",
  }));
}

export async function saveBotTranslation(key: string, language: Lang, value: string) {
  const session = await requirePermission("settings.translations", "edit");
  if (!value.trim()) throw new Error("Value cannot be empty");
  await db
    .insert(botTranslations)
    .values({ key, language, value: value.trim(), updatedBy: session.sub })
    .onConflictDoUpdate({
      target: [botTranslations.key, botTranslations.language],
      set: { value: value.trim(), updatedAt: new Date(), updatedBy: session.sub },
    });
}
