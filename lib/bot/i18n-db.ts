import { db } from "@/lib/db/client";
import { botTranslations } from "@/lib/db/schema";
import { tr as trCode, type Lang } from "./i18n";

// 60-second in-memory cache — bulk-loaded for efficiency
let cache: Record<string, Record<string, string>> = {};
let cacheAt = 0;

async function loadCache() {
  if (Date.now() - cacheAt < 60_000) return cache;
  try {
    const rows = await db.select().from(botTranslations);
    const next: typeof cache = {};
    for (const row of rows) {
      if (!next[row.language]) next[row.language] = {};
      next[row.language][row.key] = row.value;
    }
    cache = next;
    cacheAt = Date.now();
  } catch {
    // DB unavailable — keep stale cache or empty; fall through to code-based
  }
  return cache;
}

export async function trDb(
  lang: Lang,
  key: string,
  vars: Record<string, string | number> = {}
): Promise<string> {
  const c = await loadCache();
  const template = c[lang]?.[key] ?? c["en"]?.[key];
  if (!template) {
    return trCode(lang, key, vars);
  }
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function invalidateTranslationCache(key?: string, lang?: Lang) {
  if (key && lang) {
    if (cache[lang]) delete cache[lang][key];
  } else {
    cache = {};
    cacheAt = 0;
  }
}
