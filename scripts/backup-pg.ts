#!/usr/bin/env node
/**
 * Weekly pg_dump backup → Telegram
 * Railway cron: 0 3 * * 0 (Sunday 3am UTC)
 * Command: npx tsx scripts/backup-pg.ts
 * Required env vars: DATABASE_URL, TELEGRAM_BOT_TOKEN, HR_NOTIFICATION_CHAT_ID
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const dbUrl = process.env.DATABASE_URL;
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.HR_NOTIFICATION_CHAT_ID;

if (!dbUrl) { console.error("[pg_dump] DATABASE_URL not set"); process.exit(1); }
if (!token || !chatId) { console.error("[pg_dump] TELEGRAM_BOT_TOKEN or HR_NOTIFICATION_CHAT_ID not set"); process.exit(1); }

const date = new Date().toISOString().split("T")[0];
const outDir = "/tmp/pg-backups";
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `hireflow-${date}.sql.gz`);

console.log(`[pg_dump] ${date} → ${outFile}`);
const start = Date.now();

try {
  execSync(`pg_dump "${dbUrl}" | gzip > "${outFile}"`, { stdio: "inherit" });
  const sizeBytes = fs.statSync(outFile).size;
  const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);
  const ms = Date.now() - start;
  console.log(`[pg_dump] dump complete · ${sizeMb} MB · ${ms}ms`);

  // Send to Telegram
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", `🗄 HireFlow weekly pg_dump — ${date}\nSize: ${sizeMb} MB`);
  form.append("document", new Blob([fs.readFileSync(outFile)], { type: "application/gzip" }), `hireflow-${date}.sql.gz`);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  const json = await res.json() as { ok: boolean; description?: string };
  if (!json.ok) {
    console.error(`[pg_dump] Telegram send failed: ${json.description}`);
    process.exit(1);
  }
  console.log(`[pg_dump] sent to Telegram ✓`);
} catch (err) {
  console.error("[pg_dump] failed:", err);
  process.exit(1);
} finally {
  try { fs.unlinkSync(outFile); } catch { /* ignore */ }
}
