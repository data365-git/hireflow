#!/usr/bin/env tsx
import { t, type Lang } from "../lib/bot/i18n";

const LANGS: Lang[] = ["uz", "ru", "en"];
const allKeys = new Set<string>();
for (const lang of LANGS) {
  Object.keys(t[lang]).forEach(k => allKeys.add(k));
}
let hasMissing = false;
for (const key of allKeys) {
  for (const lang of LANGS) {
    if (!t[lang][key]) {
      console.error(`MISSING [${lang}] ${key}`);
      hasMissing = true;
    }
  }
}
if (!hasMissing) console.log(`✅ All ${allKeys.size} keys present in uz/ru/en`);
process.exit(hasMissing ? 1 : 0);
