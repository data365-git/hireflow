#!/usr/bin/env tsx
/**
 * Daily CSV backup — runs directly in the Railway cron service.
 * No HTTP hop, no BACKUP_SECRET needed.
 *
 * Railway cron: 0 2 * * *  (2am UTC daily)
 * Start command: npm run backup:run
 * Required env vars: DATABASE_URL, TELEGRAM_BOT_TOKEN, HR_NOTIFICATION_CHAT_ID
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import {
  candidates,
  applications,
  vacancies,
  vacancyStages,
  backupRuns,
} from "../lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.HR_NOTIFICATION_CHAT_ID;

if (!DATABASE_URL) { console.error("[backup-cron] DATABASE_URL not set"); process.exit(1); }
if (!TOKEN)        { console.error("[backup-cron] TELEGRAM_BOT_TOKEN not set"); process.exit(1); }
if (!CHAT_ID)      { console.error("[backup-cron] HR_NOTIFICATION_CHAT_ID not set"); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
const db = drizzle(pool);

const date = new Date().toISOString().split("T")[0];
const start = Date.now();

const runId = crypto.randomUUID();

async function sendAlert(text: string) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
      signal: controller.signal,
    });
    clearTimeout(t);
  } catch { /* best-effort */ }
}

function csvEsc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

async function run() {
  console.log(`[backup-cron] start · ${date}`);

  await db.insert(backupRuns).values({
    id: runId,
    kind: "csv",
    status: "running",
    startedAt: new Date(),
  });

  try {
    const rows = await db
      .select({
        candidate: candidates,
        app: applications,
        vacancy: vacancies,
        stage: vacancyStages,
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
      .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id));

    const headers = ["Name", "Telegram", "Phone", "Vacancy", "Stage", "Applied At"];
    const lines = [headers.join(",")];
    for (const { candidate: c, app: a, vacancy: v, stage: s } of rows) {
      lines.push(
        [
          csvEsc(c.fullName),
          csvEsc(c.telegramUsername ? `@${c.telegramUsername}` : ""),
          csvEsc(c.phone ?? ""),
          csvEsc(v.title),
          csvEsc(s?.name ?? ""),
          csvEsc(a.appliedAt ? new Date(a.appliedAt).toISOString().split("T")[0] : ""),
        ].join(",")
      );
    }
    const csv = lines.join("\n");

    const form = new FormData();
    form.append("chat_id", CHAT_ID!);
    form.append("caption", `📊 HireFlow daily backup — ${date}\n${rows.length} applications`);
    form.append(
      "document",
      new Blob([csv], { type: "text/csv" }),
      `hireflow-backup-${date}.csv`
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const json = await res.json() as { ok: boolean; description?: string };
      if (!json.ok) throw new Error(`Telegram error: ${json.description}`);
    } finally {
      clearTimeout(timeout);
    }

    const durationMs = Date.now() - start;
    console.log(`[backup-cron] done · rows=${rows.length} · ms=${durationMs}`);

    await db
      .update(backupRuns)
      .set({ status: "success", rowCount: rows.length, durationMs, finishedAt: new Date() })
      .where(eq(backupRuns.id, runId));

  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[backup-cron] failed:", err);

    await db
      .update(backupRuns)
      .set({ status: "failed", durationMs, errorMessage, finishedAt: new Date() })
      .where(eq(backupRuns.id, runId));

    await sendAlert(`❌ HireFlow daily backup FAILED — ${date}\n${errorMessage}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
