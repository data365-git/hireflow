import { db } from "@/lib/db/client";
import { botTranslations } from "@/lib/db/schema";
import { t as codeStrings, type Lang } from "./i18n";

// 60-second in-memory cache
let cache: Record<string, Record<string, string>> = {};
let cacheAt = 0;

async function loadCache() {
  if (Date.now() - cacheAt < 60_000) return cache;
  const rows = await db.select().from(botTranslations);
  const next: typeof cache = {};
  for (const row of rows) {
    if (!next[row.language]) next[row.language] = {};
    next[row.language][row.key] = row.value;
  }
  cache = next;
  cacheAt = Date.now();
  return cache;
}

export async function trDb(key: string, lang: Lang, vars: Record<string, string | number> = {}): Promise<string> {
  const c = await loadCache();
  let text = c[lang]?.[key] ?? c["en"]?.[key] ?? codeStrings[lang]?.[key] ?? codeStrings["en"]?.[key] ?? `[!${key}!]`;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}
